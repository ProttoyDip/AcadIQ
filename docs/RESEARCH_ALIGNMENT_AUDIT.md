# Research Alignment Audit

Product position: **an explainable AI-powered pre-exam quality assurance platform**.

This audit records the backend state found before the Phase 7-9 upgrade and the implementation plan used for the upgrade. Question generation, chatbot behavior, and grading replacement are out of scope.

## Pre-upgrade implementation

### Database and models

- MySQL 8, Docker Compose, Prisma, and deploy-time migrations were already established.
- Core ownership and document models existed: `User`, `Course`, `SyllabusDocument`, `QuestionPaper`, and `Question`.
- `AnalysisReport.resultJson` stored full AI payloads and `Recommendation` stored queryable recommendation rows.
- Rubric and student-answer models existed but are adjacent to, rather than central to, pre-exam QA.
- A partial Phase 7 block had been appended to `schema.prisma` using incompatible text encoding. It was not backed by a migration and could not be treated as a working database implementation.

### API design

- JWT authentication, ownership checks, Zod validation, rate limiting, a consistent response envelope, and centralized errors were already present.
- Existing endpoints covered exam analysis, syllabus coverage, pairwise paper similarity, question review, and CO mapping.
- `POST /api/analysis/exam` and `GET /api/reports/:id` already existed.
- Canonical `/api/memory/check` and `/api/co/analyze` paths were missing.
- Report reads could not include normalized score, explanation, or CO-mapping records because those records did not exist.

### AI module

- Prompts, provider client, pipelines, Zod response validation, services, and repositories were usefully separated.
- Prompt-injection boundaries were stated and malformed AI output failed closed with a 502 response.
- Exam output lacked score factors, difficulty, issues, positive points, confidence, and an overall explanation.
- Similarity compared one current paper with one selected previous paper; it was not a course-wide academic memory.
- CO mapping returned rationales but did not persist outcomes or mappings as first-class records.
- Syllabus and question-review analyses returned conclusions without mandatory decision/reason/confidence explanations.

### Document processing and storage

- PDF-only upload, a 10 MB limit, UUID filenames, text extraction, question segmentation, and transactional question storage were present.
- Files were stored on local disk and persisted through a Docker volume. Internal paths were hidden from API responses.
- Remaining production gaps are OCR for scanned PDFs, extracted-text caching, checksums/versioning, malware scanning, object storage, retention controls, and background processing.

## Missing capabilities identified

1. A first-class explainable Exam Quality Score with queryable factors, positives, issues, recommendations, and confidence.
2. Automatic accumulation and course-wide querying of historical questions.
3. A stable academic-memory response with similarity evidence and replacement guidance.
4. Persisted course outcomes and per-question CO mappings.
5. A mandatory explanation contract and persisted decision/reason/confidence for every AI report.
6. Complete report retrieval combining the JSON snapshot with normalized intelligence records.

## Database changes

- Add `ExamQualityScore` as a one-to-one extension of `AnalysisReport`.
- Add `AIExplanation` as a one-to-one audit record for every report.
- Add `QuestionHistory`, linked to its course and source question when available.
- Add `CourseOutcome` with course/code uniqueness.
- Add report-scoped `QuestionCOMapping` records with decision, reason, and confidence.
- Add `ACADEMIC_MEMORY` to `ReportType`.
- Backfill extracted questions into memory and populate memory transactionally on future uploads.

## Required APIs

- `POST /api/analysis/exam`: explainable quality score, coverage, difficulty, Bloom distribution, factors, issues, recommendations, and explanation.
- `POST /api/memory/check`: compare a stored paper or supplied questions against course history or supplied history.
- `POST /api/co/analyze`: persist and return CO coverage, missing outcomes, and explained mappings.
- `GET /api/reports/:id`: return the complete owned report with normalized intelligence records.
- Keep `/api/analysis/similarity`, `/api/analysis/co-mapping`, and `/api/analyze/*` for compatibility.

## Implementation plan

1. Normalize the Prisma schema and add a forward-only MySQL migration with data backfill.
2. Define explanation-first domain types and strict Zod schemas.
3. Upgrade every prompt so results include decision, reason, and confidence.
4. Add academic-memory pipeline/service/repository layers and automatic upload ingestion.
5. Persist exam scores and CO intelligence atomically with reports.
6. Add canonical authenticated routes while retaining response aliases used by the frontend.
7. Expand report retrieval and verify Prisma validation, TypeScript compilation, and contract tests.

## Deferred after Phase 9

- Embedding generation/vector retrieval. `embedding_reference` is ready for an external vector index; the initial engine uses bounded, validated LLM semantic comparison.
- OCR and asynchronous processing for scanned or large documents.
- S3-compatible storage, lifecycle policy, and document checksum/version metadata.
- Frontend mock replacement and hackathon narrative work belong to the integration/demo phases.
