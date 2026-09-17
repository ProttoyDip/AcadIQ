# AI Processing Pipeline

AcadIQ's AI is explicitly **decision-support**, not decision-making: every pipeline stops at "here's evidence and a suggestion" — faculty apply their own judgment before acting on it.

## Flow

```mermaid
flowchart LR
    A["Faculty uploads PDF<br/>(syllabus / question paper)"] --> B["Document parser<br/>(multer + pdf-parse)"]
    B --> C["Text extraction<br/>+ question segmentation"]
    C --> D["Prompt builder<br/>(ai/prompts/*)"]
    D --> E["AI analysis engine<br/>(LLM call, ai/llmClient.ts)"]
    E --> F["Response validation<br/>(Zod schemas, ai/schemas/*)"]
    F -->|invalid| G["Corrective retry<br/>(maximum 1 repair)"]
    G -->|invalid again| K["Structured failure<br/>decision / reason / confidence=0"]
    G -->|valid| H
    F -->|valid| H["Structured JSON result"]
    H --> I["Database storage<br/>analysis_reports + recommendations"]
    I --> J["Dashboard visualization<br/>charts, cards, recommendation panel"]
```

## Stage details

1. **Upload** — `POST /api/documents/upload` (multipart, PDF only, 10MB cap, enforced in `middleware/upload.middleware.ts`).
2. **Parse** — `utils/pdfParser.ts` extracts raw text; `services/upload.service.ts` segments question papers into individual questions using a numbering heuristic (`Q1`, `1.`, etc.) and best-effort marks extraction.
3. **Prompt management** — each analysis type has its own prompt module under `ai/prompts/`, separating the *system* instruction (task definition + strict output contract) from the *user* content (syllabus/question text). This keeps prompts versionable and testable independent of the LLM call itself.
4. **AI analysis engine** — `ai/llmClient.ts` calls an OpenAI-compatible chat completions endpoint with `response_format: json_object`, so the model is constrained to return JSON. The legacy provider is configured via env vars (`OPENAI_BASE_URL`, `OPENAI_MODEL`); `ai/providers.ts` adds any number of further providers from `AI_PROVIDERS_JSON`, keeping the pipeline vendor-agnostic. `routedCompletion` walks the resulting candidate list in order, so an exhausted account degrades to the next provider instead of failing the analysis. The caller chooses a model per request via `X-AI-Model` (`ai/modelContext.ts` carries the selection through the request in an `AsyncLocalStorage` scope), and the answering model is reported back in the response's `ai` block. See [`ai-providers.md`](ai-providers.md).
5. **Response validation** — `ai/schemas/analysisResponse.schema.ts` (Zod) validates the LLM's JSON against the exact shape the frontend expects. A failed validation raises an `AppError(502)` instead of persisting malformed data — the analysis is retried or surfaced as an error to the faculty member, never silently stored.
6. **Storage** — validated results are stored in `analysis_reports.result_json` (full structured result) and exploded into `recommendations` rows (message + priority) for querying/sorting.
7. **Visualization** — the frontend renders `result_json` via Chart.js (`BloomChart`, `CoverageChart`) and the `RecommendationPanel`/`ReportViewer` components — no re-computation, just rendering what was validated and stored.

## Error handling

| Failure | Handling |
| --- | --- |
| Missing `OPENAI_API_KEY` | `AppError(503)` — "AI provider is not configured" |
| LLM HTTP error | Logged, `AppError(502)` — "AI analysis request failed" |
| Rate limit (429), exhausted credit (402 / `insufficient_quota`), or rejected credential (401/403) | The provider is put on a short local cooldown and the next configured provider is tried. Only when every candidate fails does the request raise `AppError(502)` with `decision: "ANALYSIS_UNAVAILABLE"` |
| Per-request token limit (413) | Not retried and not failed over — a payload one provider refuses will be refused again. Surfaced as a sized error naming the limit |
| Provider unreachable / unreadable body | Treated as a failed attempt; retried, then failed over when fallback is enabled |
| Non-JSON / malformed LLM output | `AppError(502)` — "AI provider returned malformed JSON" |
| JSON that doesn't match the expected schema | `AppError(502)` with Zod's flattened error details — "AI response failed validation" |
| Missing syllabus/question paper prerequisites | `AppError(400/404)` before any LLM call is made (fail fast, save the API call) |

## Reliability contract

Every successful analysis exposes the same decision contract at the response root and in `explanation`:

```json
{
  "decision": "REVIEW",
  "reason": "Evidence for the decision, followed by the confidence inputs used.",
  "confidence": 72
}
```

The model cannot set the final confidence. `ai/confidence.ts` replaces it after validation using fixed weights: document completeness (30), number of questions analyzed up to 30 (25), syllabus availability (20), course-outcome availability (15), and historical evidence up to 30 questions across 3 exams (10). The reason records all five inputs.

Malformed provider output is normalized (including fenced JSON) and retried up to three times. Schema-invalid JSON receives one corrective generation attempt. If recovery still fails, AcadIQ rejects the result without persistence and returns a fallback decision with `decision: "ANALYSIS_UNAVAILABLE"`, an explicit reason, and `confidence: 0`.

## Intelligence analyses mapped to pipelines

| Feature | Endpoint | Pipeline | Prompt |
| --- | --- | --- | --- |
| Exam Quality Analyzer | `POST /api/analysis/exam` | `ai/pipeline/examAnalysisPipeline.ts` | `ai/prompts/examAnalysis.prompt.ts` |
| Question Review | `POST /api/analysis/question-review` | `ai/pipeline/questionReviewPipeline.ts` | `ai/prompts/questionReview.prompt.ts` |
| Course Outcome Mapping | `POST /api/analysis/co-mapping` | `ai/pipeline/coMappingPipeline.ts` | `ai/prompts/coMapping.prompt.ts` |
| Syllabus Coverage Analyzer | `POST /api/analysis/syllabus` | `ai/pipeline/syllabusPipeline.ts` | `ai/prompts/syllabusAnalysis.prompt.ts` |
| Question Similarity Detector | `POST /api/analysis/similarity` | `ai/pipeline/similarityPipeline.ts` | `ai/prompts/similarity.prompt.ts` |
| Academic Memory Engine | `POST /api/memory/check` | `ai/pipeline/academicMemoryPipeline.ts` | `ai/prompts/academicMemory.prompt.ts` |

The Recommendation Engine isn't a separate pipeline — each analysis prompt is required to emit a `recommendations` (or single `recommendation`) field as part of its structured output, so suggestions are always grounded in the same evidence used for scoring.

## Question embedding index (similarity + academic memory)

The similarity and academic-memory pipelines no longer send every current×previous question pair to the LLM in one prompt (which silently truncated at real archive sizes and was non-deterministic). They now run **shortlist → explain**:

1. **Embed locally.** `ai/embedding/embeddingService.ts` runs `Xenova/all-MiniLM-L6-v2` (int8 ONNX, 384-dim, ~23 MB) through `@huggingface/transformers` inside a `worker_threads` worker (`embedder.worker.ts`) so inference never blocks the Express event loop or the Docker healthcheck. Vectors are mean-pooled and L2-normalised at write time, so cosine is a plain dot product. No API key, no rate limit, fully offline in production (`EMBEDDING_ALLOW_REMOTE=false`, model baked into the image by `npm run embeddings:download`).
2. **Store in MySQL.** `embedding_vectors` holds one Float32LE `LONGBLOB` per `(ownerType, ownerId, model)` — a separate, regenerable table so `questions` stays BLOB-free and several model versions can coexist. `QuestionHistory.embeddingReference` now records `"<model>#<vectorId>"`. Vectors are written after the upload transaction commits (`uploadService.uploadQuestionPaper`); an embedding failure is logged and never fails the upload. Anything missing is embedded lazily at analysis time (`ensureIndexed`), so `npm run embeddings:backfill` is optional and resumable.
3. **Shortlist.** `ai/retrieval/candidateSelector.ts` takes top-k (`EMBEDDING_TOP_K`, default 5) neighbours per current question above an adaptive floor `max(EMBEDDING_SIMILARITY_FLOOR, p95 of the previous paper's own pairwise cosines)`, capped at `EMBEDDING_MAX_CANDIDATE_PAIRS` (default 40). Zero candidates ⇒ zero LLM calls.
4. **Explain.** The LLM receives only the shortlisted pairs with their `vectorSimilarity` and must classify each into `matches` or `rejectedPairs`; it cannot invent pairs. Batches of 30 pairs per call.

Every match carries the reproducible `vectorSimilarity` next to the model's `similarityPercentage`, plus `source: "EMBEDDING+LLM"`. Each result carries a `retrieval` block (`method`, `embeddingModel`, `similarityFloor`, `backgroundP95`, `candidatePairs`, `rejectedPairs`, `llmCalls`, `truncated`). If the embedding runtime is unavailable (e.g. `EMBEDDING_ENABLED=false`, model missing) the pipelines fall back to the legacy single-prompt path and record `method: "LLM_ONLY"` with the `fallbackReason`.

Ops: `npm run embeddings:backfill [-- --course <id>] [--limit <n>]` (idempotent, id-cursor paginated), `npm run embeddings:calibrate` (prints per-course cosine percentiles to justify the floor). The backend image must be glibc-based (`node:20-slim`): `onnxruntime-node` ships no musl/alpine binary.

## Reliability layer

Every pipeline now calls one entry point, `ai/runner.ts#runLlmAnalysis(promptDescriptor, args, schema, options)`, which composes **cache → sampler → validation → provenance trace**.

### Honest confidence (reliability v2)

`confidence` used to be a single number that measured only how much input was uploaded. It is now split:

| Field | Meaning | Source |
| --- | --- | --- |
| `evidenceSufficiency` (0-100) | Input completeness: documents 30, question sample 25, syllabus 20, course outcomes 15, history 10. `evidenceBreakdown` shows the arithmetic. | Deterministic (`ai/confidence.ts`) |
| `modelAgreement` (0-100 or **null**) | Stability of the answer across k independent samples. **null when k = 1** — a single run never claims agreement. This is *not* accuracy. | Self-consistency sampling |
| `retrievalSupport` (0-100 or null) | Best embedding cosine behind a similarity result. | Model-free |
| `confidence` | Kept for compatibility: `min(evidenceSufficiency, modelAgreement ?? evidenceSufficiency)`. Never higher than the v1 value. | Derived |

Every v2 result carries `reliabilityVersion: 2`; reports without it are v1 and must be read as "input completeness only". The model's `reason` text is no longer rewritten; the arithmetic lives in `reliabilityNote`. Nullable columns `ai_explanations.evidence_sufficiency` / `model_agreement` and `exam_quality_scores.model_agreement` / `quality_score_spread` were added.

### Self-consistency sampling

Requests accept `reliability: "fast" | "verified"` (default `fast` = one call at temperature 0.2, today's behaviour). `verified` runs `RELIABILITY_SAMPLE_COUNT` (3) samples **sequentially** at `RELIABILITY_SAMPLE_TEMPERATURE` (0.6 — 0.2 would produce near-identical samples and fake agreement) and aggregates per pipeline (`ai/aggregate.ts`):

- Exam quality: median `qualityScore`, `qualityScoreSpread` = max − min; the median sample supplies the prose.
- Similarity / academic memory candidate pairs: per-pair majority vote; each match carries `votes: "2/3"` and `contested`.
- CO mapping: modal outcome per question.
- Bloom labels: new tiny `bloom-label` prompt (`ai/pipeline/bloomLabelPipeline.ts`), modal level per question — this is what writes `Question.bloomLevel` / `Question.topic`.
- Syllabus coverage, full question review, copilot: never sampled (long-in/long-out). `POST /analysis/full` is always `fast`.

A process-wide semaphore (`ai/rateGate.ts`, `LLM_MAX_CONCURRENT`) bounds in-flight provider calls across all requests.

**Cross-model agreement.** `reliability: "cross-model"` runs one low-temperature call each against the primary model and `DUAL_EVAL_SECONDARY_MODEL` and votes across them. Same-model self-consistency can pin near 100 % (observed with `gpt-oss-120b`); two vendors disagreeing is the stronger signal. The mode and participating models are recorded in `agreementMode` / `agreementModels` and on the provenance run (`model = "a+b"`).

## Retrieval built on the embedding index

- **Copilot RAG** (`services/copilot/rag.service.ts`): syllabi are split into ~500-char sentence-aware chunks (`syllabus_chunks`, embedded as `SYLLABUS_CHUNK`) at upload. Each turn embeds the user's message and retrieves the top-6 passages (cosine ≥ 0.25) and top-10 questions (≥ 0.30); the prompt leads with those and labels them. When nothing clears the floor or embeddings are unavailable it falls back to the full syllabus, and the response's `retrieval` block says so.
- **Upload-time duplicate warning**: after a paper is indexed, every new question is compared against the rest of the course bank; matches at cosine ≥ `EMBEDDING_NEAR_DUPLICATE` are returned as `duplicateWarnings` on the upload response (model-free, never fails the upload).
- **Nearest-neighbour search**: `GET /api/courses/:id/questions/search?q=…&k=10&floor=0.3` — "find questions like this" across the course, no LLM call.

### Provenance

Each LLM run is recorded as an `analysis_runs` row (pipeline, `promptId@version`, `promptHash`, model, temperature, `inputHash`, sampleCount, cacheHit, token usage, latency, status `OK|VALIDATION_FAILED|PROVIDER_ERROR`, agreement JSON, requestId) with raw responses in `analysis_run_samples`. Runs are written **in the same transaction as the report**; runs that never produced a report (429 storms, validation failures) are written fire-and-forget with `report_id NULL` — the first time those have been visible.

Prompts are descriptors (`ai/prompts/registry.ts#definePrompt`) whose hash is `sha256(system + build.toString())`, so any template edit changes the hash without a manual bump. `tests/promptHashes.snapshot.json` is asserted by the test suite; after an intentional prompt change bump the version and run `npm run prompts:snapshot`.

Endpoints: `GET /api/reports/:id/provenance`, `GET /api/reports/:id/provenance/runs/:runId/samples/:i`, `POST /api/reports/:id/reproduce` (re-runs the same analysis on the same inputs and diffs the headline numbers, reporting whether inputs and prompts are unchanged). Retention: `npm run traces:prune` (`TRACE_RETENTION_DAYS`).

### Content-hash cache

`llm_cache_entries` stores schema-valid raw responses keyed by `sha256(promptHash|model|temperature|inputHash|sampleIndex)`. `sampleIndex` is in the key on purpose: otherwise a k=3 run would read one cached response three times and report 100 % agreement. Entries are re-validated on read, so tightening a Zod schema invalidates naturally; editing a prompt changes `promptHash` so no manual flush is needed. `?noCache=true` bypasses reads. TTL `LLM_CACHE_TTL_DAYS`.

## Paper generator (agent loop)

`POST /api/analysis/generate-paper` `{ courseId, questionCount, totalMarks, targetBloom, outcomeWeights, passThreshold, maxIterations }` runs **generate → verify → repair**. The verifier is the existing analysers (question review for clarity + observed Bloom, CO mapping, syllabus coverage) plus deterministic checks (marks sum, Bloom-mix fit, CO-weight fit, embedding originality against the course bank). The weighted objective (clarity 25, Bloom fit 25, CO fit 20, coverage 20, originality 10) must reach `passThreshold`; violations are fed back verbatim into the next generation. Results are stored as `GENERATED_PAPER` reports with full provenance. The objective measures constraint satisfaction, not pedagogical quality.

## Faculty feedback (bootstrapping ground truth)

`POST /api/feedback/questions` records thumbs-up/down and Bloom/topic corrections per question and report; corrections are written back to `Question`. `GET /api/feedback/stats?courseId=` reports agreement and Cohen's κ once ≥ 10 corrections exist. This is the labelled set the project otherwise lacks.

## Governance: PII redaction

`ai/redaction.ts` scrubs emails, phone numbers, student-ID-shaped tokens, `Name:`/`Roll No:` fields and any caller-supplied identifiers before student work is sent to the dual evaluator's LLM jurors (or the Python tier). Regex-based — no NER — so it is best-effort; the response reports `privacy.pii_redactions` counts.

## Persisted derived data

- `Question.bloomLevel` / `Question.topic` are written by the Bloom-label pipeline on every question review, and by faculty corrections.
- `SyllabusDocument.extractedText` is stored at upload; analyses and the copilot no longer re-parse the PDF.
- `semester` is normalised to `Spring | Summer | Fall | Winter | Semester 1-3` on upload (a year suffix is accepted and dropped); existing rows were migrated.
