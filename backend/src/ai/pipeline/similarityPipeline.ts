import { QUESTION_SIMILARITY_PROMPT, SIMILARITY_CANDIDATE_PROMPT } from "../prompts/similarity.prompt";
import { questionSimilarityResponseSchema, similarityCandidateResponseSchema } from "../schemas/analysisResponse.schema";
import { QuestionSimilarityResult, RetrievalProvenance, SimilarityMatch } from "../../models/types";
import { AppError } from "../../middleware/error.middleware";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { aggregateSets, AgreementSummary } from "../aggregate";
import { runLlmAnalysis } from "../runner";
import { embeddingService, EmbeddingRef } from "../embedding/embeddingService";
import { chunk, selectCandidatePairs } from "../retrieval/candidateSelector";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { PipelineOptions } from "./options";

const PAIRS_PER_LLM_CALL = 30;

export interface SimilarityQuestion {
  id: number;
  text: string;
  /** Where to persist this question's vector; omit for ad-hoc text. */
  embeddingRef?: EmbeddingRef;
}

interface CoreResult extends QuestionSimilarityResult {
  agreement: AgreementSummary | null;
}

function pairKey(currentId: number, previousId: number) {
  return `${currentId}:${previousId}`;
}

/** Combines per-batch agreement summaries into one report-level number (weighted by pair count). */
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
    jaccard: parts.every((p) => p.jaccard !== undefined) ? Math.round((parts.reduce((s, p) => s + p.jaccard!, 0) / parts.length) * 1000) / 1000 : undefined,
  };
}

async function runLlmOnlyPath(
  currentQuestions: SimilarityQuestion[],
  previousQuestions: SimilarityQuestion[],
  fallbackReason: string
): Promise<CoreResult> {
  const { consensus: parsed } = await runLlmAnalysis(
    QUESTION_SIMILARITY_PROMPT,
    [currentQuestions.map(({ id, text }) => ({ id, text })), previousQuestions.map(({ id, text }) => ({ id, text })), 40],
    questionSimilarityResponseSchema
  );
  const currentIds = new Set(currentQuestions.map((question) => question.id));
  const previousIds = new Set(previousQuestions.map((question) => question.id));
  if (parsed.matches.some((match) => !currentIds.has(match.currentQuestionId) || !previousIds.has(match.previousQuestionId))) {
    throw new AppError("AI response referenced an unknown question", 502);
  }
  const retrieval: RetrievalProvenance = {
    method: "LLM_ONLY",
    embeddingModel: null,
    similarityFloor: null,
    configuredFloor: null,
    backgroundP95: null,
    nearDuplicateThreshold: null,
    topK: null,
    candidatePairs: currentQuestions.length * previousQuestions.length,
    rejectedPairs: 0,
    llmCalls: 1,
    truncated: false,
    fallbackReason,
  };
  return {
    ...parsed,
    matches: parsed.matches.map((match) => ({ ...match, source: "LLM_ONLY" as const })),
    retrieval,
    agreement: null,
  };
}

async function runShortlistPath(
  currentQuestions: SimilarityQuestion[],
  previousQuestions: SimilarityQuestion[],
  options: PipelineOptions
): Promise<CoreResult> {
  // Previous ids are negated so both sides can share one lookup even when ids collide (ad-hoc input).
  const vectors = await embeddingService.resolveVectors([
    ...currentQuestions.map((question) => ({ key: question.id, text: question.text, ref: question.embeddingRef })),
    ...previousQuestions.map((question) => ({ key: -question.id, text: question.text, ref: question.embeddingRef })),
  ]);
  const current = currentQuestions.flatMap((question) => {
    const vector = vectors.get(question.id);
    return vector ? [{ ...question, vector }] : [];
  });
  const previous = previousQuestions.flatMap((question) => {
    const vector = vectors.get(-question.id);
    return vector ? [{ ...question, vector }] : [];
  });

  const selection = selectCandidatePairs(current, previous);
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
      matches: [],
      overallDuplicationPercentage: 0,
      recommendation: "No question pair exceeded the embedding similarity floor; the papers appear to assess distinct material.",
      explanation: {
        decision: "NO_CANDIDATES_ABOVE_FLOOR",
        reason: `The local embedding model found no pair with cosine similarity at or above ${selection.floor.toFixed(2)} across ${current.length}×${previous.length} comparisons, so no LLM call was needed.`,
        confidence: 0,
      },
      retrieval,
      agreement: null,
    };
  }

  const vectorByPair = new Map(selection.pairs.map((pair) => [pairKey(pair.current.id, pair.previous.id), pair.vectorSimilarity]));
  const matches: SimilarityMatch[] = [];
  const recommendations: string[] = [];
  const reasons: string[] = [];
  const agreements: AgreementSummary[] = [];
  let rejected = 0;

  for (const batch of chunk(selection.pairs, PAIRS_PER_LLM_CALL)) {
    const batchKeys = new Set(batch.map((pair) => pairKey(pair.current.id, pair.previous.id)));
    const run = await runLlmAnalysis(
      SIMILARITY_CANDIDATE_PROMPT,
      [batch.map((pair) => ({
        currentQuestionId: pair.current.id,
        currentText: pair.current.text,
        previousQuestionId: pair.previous.id,
        previousText: pair.previous.text,
        vectorSimilarity: Number(pair.vectorSimilarity.toFixed(3)),
      }))],
      similarityCandidateResponseSchema,
      {
        reliability: options.reliability,
        // Per-pair vote: a pair is a match when a majority of samples confirmed it.
        aggregate: (samples) => {
          const sets = samples.map((s) => new Set(s.matches.map((m) => pairKey(m.currentQuestionId, m.previousQuestionId))));
          const { kept, agreement } = aggregateSets(sets);
          const keptMatches = [...kept].map((key) => {
            const confirming = samples.flatMap((s) => s.matches).filter((m) => pairKey(m.currentQuestionId, m.previousQuestionId) === key);
            const base = confirming[0];
            const pct = confirming.map((m) => m.similarityPercentage).sort((a, b) => a - b);
            return { ...base, similarityPercentage: pct[Math.floor(pct.length / 2)] };
          });
          const rejectedPairs = [...batchKeys].filter((key) => !kept.has(key)).map((key) => {
            const [c, p] = key.split(":").map(Number);
            const reason = samples.flatMap((s) => s.rejectedPairs ?? []).find((r) => r.currentQuestionId === c && r.previousQuestionId === p)?.reason
              ?? "Not confirmed by a majority of samples.";
            return { currentQuestionId: c, previousQuestionId: p, reason };
          });
          return {
            consensus: { ...samples[0], matches: keptMatches, rejectedPairs, explanation: samples[0].explanation },
            agreement,
          };
        },
      }
    );
    const parsed = run.consensus;
    retrieval.llmCalls += run.trace.sampleCount;
    if (run.agreement) agreements.push(run.agreement);
    const votes = run.agreement?.votes ?? {};
    const contested = new Set(run.agreement?.contested ?? []);
    for (const match of parsed.matches) {
      const key = pairKey(match.currentQuestionId, match.previousQuestionId);
      if (!batchKeys.has(key)) throw new AppError("AI response referenced a pair that was not shortlisted", 502);
      matches.push({
        ...match,
        vectorSimilarity: Number(vectorByPair.get(key)!.toFixed(4)),
        source: "EMBEDDING+LLM",
        votes: votes[key],
        contested: contested.has(key) || undefined,
      });
    }
    rejected += (parsed.rejectedPairs ?? []).filter((pair) => batchKeys.has(pairKey(pair.currentQuestionId, pair.previousQuestionId))).length;
    recommendations.push(parsed.recommendation);
    reasons.push(parsed.explanation.reason);
  }
  retrieval.rejectedPairs = rejected;

  // Deterministic headline: share of current questions with at least one confirmed match.
  const matchedCurrent = new Set(matches.map((match) => match.currentQuestionId));
  const overallDuplicationPercentage = current.length ? Math.round((matchedCurrent.size / current.length) * 100) : 0;
  const nearDuplicates = matches.filter((match) => (match.vectorSimilarity ?? 0) >= env.embedding.nearDuplicate).length;

  return {
    matches: matches.sort((a, b) => (b.vectorSimilarity ?? 0) - (a.vectorSimilarity ?? 0)),
    overallDuplicationPercentage,
    recommendation: recommendations[0] ?? "Review the confirmed matches before finalising the paper.",
    explanation: {
      decision: matches.length ? (nearDuplicates ? "NEAR_DUPLICATES_FOUND" : "SIMILAR_QUESTIONS_FOUND") : "CANDIDATES_REJECTED",
      reason: `${reasons.join(" ")} Embedding shortlist: ${selection.pairs.length} candidate pair${selection.pairs.length === 1 ? "" : "s"} at or above cosine ${selection.floor.toFixed(2)}; the model confirmed ${matches.length} and rejected ${rejected}.`,
      confidence: 0,
    },
    retrieval,
    agreement: mergeAgreements(agreements),
  };
}

export async function runSimilarityPipeline(
  currentQuestions: SimilarityQuestion[],
  previousQuestions: SimilarityQuestion[],
  evidence?: ConfidenceEvidence,
  options: PipelineOptions = {}
): Promise<QuestionSimilarityResult> {
  let core: CoreResult;
  if (!embeddingService.available) {
    core = await runLlmOnlyPath(currentQuestions, previousQuestions, embeddingService.unavailableReason ?? "embeddings disabled");
  } else {
    try {
      core = await runShortlistPath(currentQuestions, previousQuestions, options);
    } catch (error) {
      // AppErrors are LLM/validation failures and must surface; anything else is an embedding fault.
      if (error instanceof AppError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      logger.warn("similarity_embedding_fallback", { reason });
      core = await runLlmOnlyPath(currentQuestions, previousQuestions, reason);
    }
  }

  const reliability = evidence ?? defaultConfidenceEvidence([
    ...currentQuestions.map((question) => question.text),
    ...previousQuestions.map((question) => question.text),
  ]);
  const bestCosine = core.matches.reduce<number | null>((best, m) => (m.vectorSimilarity === undefined ? best : Math.max(best ?? 0, m.vectorSimilarity)), null);
  const explanation = applyCalculatedConfidence(core.explanation, reliability, { agreement: core.agreement, retrievalSupport: bestCosine });
  const { agreement: _agreement, ...rest } = core;
  return {
    ...rest,
    matches: core.matches.map((match) => ({
      ...match,
      confidence: explanation.confidence,
      modelAgreement: explanation.modelAgreement,
      evidenceSufficiency: explanation.evidenceSufficiency,
    })),
    explanation,
  };
}
