import { AppError } from "../../middleware/error.middleware";
import { AcademicMemoryResult, RetrievalProvenance } from "../../models/types";
import { ACADEMIC_MEMORY_CANDIDATE_PROMPT, ACADEMIC_MEMORY_PROMPT } from "../prompts/academicMemory.prompt";
import { academicMemoryCandidateResponseSchema, academicMemoryResponseSchema } from "../schemas/analysisResponse.schema";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { aggregateSets, AgreementSummary } from "../aggregate";
import { runLlmAnalysis } from "../runner";
import { embeddingService, EmbeddingRef } from "../embedding/embeddingService";
import { chunk, selectCandidatePairs } from "../retrieval/candidateSelector";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { PipelineOptions } from "./options";

const PAIRS_PER_LLM_CALL = 30;

export interface MemoryNewQuestion {
  id: number;
  text: string;
  embeddingRef?: EmbeddingRef;
}

export interface MemoryHistoricalQuestion extends MemoryNewQuestion {
  semester: string;
  year: number;
}

type MemoryMatch = AcademicMemoryResult["similarQuestions"][number];
interface CoreResult extends AcademicMemoryResult {
  agreement: AgreementSummary | null;
}

function pairKey(newId: number, historicalId: number) {
  return `${newId}:${historicalId}`;
}

function mergeAgreements(parts: AgreementSummary[]): AgreementSummary | null {
  if (!parts.length) return null;
  const weights = parts.map((p) => Object.keys(p.votes ?? {}).length || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const agreement = Math.round(parts.reduce((sum, p, i) => sum + p.agreement * weights[i], 0) / total);
  return {
    sampleCount: parts[0].sampleCount,
    agreement,
    variance_percentage: 100 - agreement,
    has_high_discrepancy: parts.some((p) => p.has_high_discrepancy),
    votes: Object.assign({}, ...parts.map((p) => p.votes ?? {})),
    contested: parts.flatMap((p) => p.contested ?? []),
  };
}

async function runLlmOnlyPath(
  newQuestions: MemoryNewQuestion[],
  historicalQuestions: MemoryHistoricalQuestion[],
  threshold: number,
  fallbackReason: string
): Promise<CoreResult> {
  const { consensus: parsed } = await runLlmAnalysis(
    ACADEMIC_MEMORY_PROMPT,
    [
      newQuestions.map(({ id, text }) => ({ id, text })),
      historicalQuestions.map(({ id, text, semester, year }) => ({ id, text, semester, year })),
      threshold,
    ],
    academicMemoryResponseSchema
  );
  const newIds = new Set(newQuestions.map((question) => question.id));
  const historicalIds = new Set(historicalQuestions.map((question) => question.id));
  if (parsed.similarQuestions.some((match) =>
    !newIds.has(match.newQuestionId) || !historicalIds.has(match.historicalQuestionId) || match.similarityScore < threshold
  )) {
    throw new AppError("AI response referenced an unknown question or ignored the similarity threshold", 502);
  }
  const retrieval: RetrievalProvenance = {
    method: "LLM_ONLY",
    embeddingModel: null,
    similarityFloor: null,
    configuredFloor: null,
    backgroundP95: null,
    nearDuplicateThreshold: null,
    topK: null,
    candidatePairs: newQuestions.length * historicalQuestions.length,
    rejectedPairs: 0,
    llmCalls: 1,
    truncated: false,
    fallbackReason,
  };
  return {
    ...parsed,
    similarQuestions: parsed.similarQuestions.map((match) => ({ ...match, source: "LLM_ONLY" as const })),
    retrieval,
    agreement: null,
  };
}

async function runShortlistPath(
  newQuestions: MemoryNewQuestion[],
  historicalQuestions: MemoryHistoricalQuestion[],
  threshold: number,
  options: PipelineOptions
): Promise<CoreResult> {
  const vectors = await embeddingService.resolveVectors([
    ...newQuestions.map((question) => ({ key: question.id, text: question.text, ref: question.embeddingRef })),
    ...historicalQuestions.map((question) => ({ key: -question.id, text: question.text, ref: question.embeddingRef })),
  ]);
  const current = newQuestions.flatMap((question) => {
    const vector = vectors.get(question.id);
    return vector ? [{ ...question, vector }] : [];
  });
  const history = historicalQuestions.flatMap((question) => {
    const vector = vectors.get(-question.id);
    return vector ? [{ ...question, vector }] : [];
  });

  const selection = selectCandidatePairs(current, history);
  const retrieval: RetrievalProvenance = {
    method: "EMBEDDING+LLM",
    embeddingModel: embeddingService.model,
    similarityFloor: Number(selection.floor.toFixed(4)),
    configuredFloor: selection.configuredFloor,
    backgroundP95: selection.backgroundP95 === null ? null : Number(selection.backgroundP95.toFixed(4)),
    nearDuplicateThreshold: env.embedding.nearDuplicate,
    topK: selection.topK,
    candidatePairs: selection.pairs.length,
    rejectedPairs: 0,
    llmCalls: 0,
    truncated: selection.truncated,
  };

  if (!selection.pairs.length) {
    return {
      similarQuestions: [],
      similarityScore: 0,
      replacementSuggestion: "No new question is close enough to stored history to need replacement.",
      explanation: {
        decision: "NO_CANDIDATES_ABOVE_FLOOR",
        reason: `The local embedding model found no pair with cosine similarity at or above ${selection.floor.toFixed(2)} across ${current.length}×${history.length} comparisons, so no LLM call was needed.`,
        confidence: 0,
      },
      retrieval,
      agreement: null,
    };
  }

  const vectorByPair = new Map(selection.pairs.map((pair) => [pairKey(pair.current.id, pair.previous.id), pair.vectorSimilarity]));
  const similarQuestions: MemoryMatch[] = [];
  const suggestions: string[] = [];
  const reasons: string[] = [];
  const agreements: AgreementSummary[] = [];
  let rejected = 0;

  for (const batch of chunk(selection.pairs, PAIRS_PER_LLM_CALL)) {
    const batchKeys = new Set(batch.map((pair) => pairKey(pair.current.id, pair.previous.id)));
    const run = await runLlmAnalysis(
      ACADEMIC_MEMORY_CANDIDATE_PROMPT,
      [batch.map((pair) => ({
        newQuestionId: pair.current.id,
        newText: pair.current.text,
        historicalQuestionId: pair.previous.id,
        historicalText: pair.previous.text,
        semester: pair.previous.semester,
        year: pair.previous.year,
        vectorSimilarity: Number(pair.vectorSimilarity.toFixed(3)),
      })), threshold],
      academicMemoryCandidateResponseSchema,
      {
        reliability: options.reliability,
        aggregate: (samples) => {
          const sets = samples.map((s) => new Set(s.similarQuestions.map((m) => pairKey(m.newQuestionId, m.historicalQuestionId))));
          const { kept, agreement } = aggregateSets(sets);
          const keptMatches = [...kept].map((key) => {
            const confirming = samples.flatMap((s) => s.similarQuestions).filter((m) => pairKey(m.newQuestionId, m.historicalQuestionId) === key);
            const scores = confirming.map((m) => m.similarityScore).sort((a, b) => a - b);
            return { ...confirming[0], similarityScore: scores[Math.floor(scores.length / 2)] };
          });
          const rejectedPairs = [...batchKeys].filter((key) => !kept.has(key)).map((key) => {
            const [n, h] = key.split(":").map(Number);
            const reason = samples.flatMap((s) => s.rejectedPairs ?? []).find((r) => r.newQuestionId === n && r.historicalQuestionId === h)?.reason
              ?? "Not confirmed by a majority of samples.";
            return { newQuestionId: n, historicalQuestionId: h, reason };
          });
          return { consensus: { ...samples[0], similarQuestions: keptMatches, rejectedPairs }, agreement };
        },
      }
    );
    const parsed = run.consensus;
    retrieval.llmCalls += run.trace.sampleCount;
    if (run.agreement) agreements.push(run.agreement);
    const votes = run.agreement?.votes ?? {};
    for (const match of parsed.similarQuestions) {
      const key = pairKey(match.newQuestionId, match.historicalQuestionId);
      if (!batchKeys.has(key)) throw new AppError("AI response referenced a pair that was not shortlisted", 502);
      if (match.similarityScore < threshold) throw new AppError("AI response ignored the similarity threshold", 502);
      similarQuestions.push({ ...match, vectorSimilarity: Number(vectorByPair.get(key)!.toFixed(4)), source: "EMBEDDING+LLM", votes: votes[key] });
    }
    rejected += (parsed.rejectedPairs ?? []).filter((pair) => batchKeys.has(pairKey(pair.newQuestionId, pair.historicalQuestionId))).length;
    suggestions.push(parsed.replacementSuggestion);
    reasons.push(parsed.explanation.reason);
  }
  retrieval.rejectedPairs = rejected;

  const similarityScore = similarQuestions.reduce((max, match) => Math.max(max, match.similarityScore), 0);
  return {
    similarQuestions: similarQuestions.sort((a, b) => b.similarityScore - a.similarityScore),
    similarityScore,
    replacementSuggestion: suggestions[0] ?? "No replacement is required.",
    explanation: {
      decision: similarQuestions.length ? "HISTORICAL_OVERLAP_FOUND" : "CANDIDATES_REJECTED",
      reason: `${reasons.join(" ")} Embedding shortlist: ${selection.pairs.length} candidate pair${selection.pairs.length === 1 ? "" : "s"} at or above cosine ${selection.floor.toFixed(2)}; the model confirmed ${similarQuestions.length} and rejected ${rejected}.`,
      confidence: 0,
    },
    retrieval,
    agreement: mergeAgreements(agreements),
  };
}

export async function runAcademicMemoryPipeline(
  newQuestions: MemoryNewQuestion[],
  historicalQuestions: MemoryHistoricalQuestion[],
  threshold: number,
  evidence?: ConfidenceEvidence,
  options: PipelineOptions = {}
): Promise<AcademicMemoryResult> {
  let core: CoreResult;
  if (!embeddingService.available) {
    core = await runLlmOnlyPath(newQuestions, historicalQuestions, threshold, embeddingService.unavailableReason ?? "embeddings disabled");
  } else {
    try {
      core = await runShortlistPath(newQuestions, historicalQuestions, threshold, options);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      logger.warn("academic_memory_embedding_fallback", { reason });
      core = await runLlmOnlyPath(newQuestions, historicalQuestions, threshold, reason);
    }
  }

  const reliability = evidence ?? defaultConfidenceEvidence([
    ...newQuestions.map((question) => question.text),
    ...historicalQuestions.map((question) => question.text),
  ]);
  const bestCosine = core.similarQuestions.reduce<number | null>((best, m) => (m.vectorSimilarity === undefined ? best : Math.max(best ?? 0, m.vectorSimilarity)), null);
  const explanation = applyCalculatedConfidence(core.explanation, reliability, { agreement: core.agreement, retrievalSupport: bestCosine });
  const { agreement: _agreement, ...rest } = core;
  return {
    ...rest,
    similarQuestions: core.similarQuestions.map((match) => ({
      ...match,
      confidence: explanation.confidence,
      modelAgreement: explanation.modelAgreement,
      evidenceSufficiency: explanation.evidenceSufficiency,
    })),
    explanation,
  };
}
