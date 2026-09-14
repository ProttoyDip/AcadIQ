import { AIExplanationResult, EvidenceBreakdown } from "../models/types";
import { AgreementSummary } from "./aggregate";

export interface ConfidenceEvidence {
  /** Percentage of supplied source text that is usable after extraction. */
  documentCompleteness: number;
  questionsAnalyzed: number;
  syllabusAvailable: boolean;
  courseOutcomesAvailable: boolean;
  historicalQuestionCount: number;
  historicalExamCount: number;
}

export interface ConfidenceCalculation {
  confidence: number;
  reason: string;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Measures whether extracted text is substantial enough to support analysis.
 * Each source contributes equally and reaches full completeness at eight words.
 */
export function calculateDocumentCompleteness(sourceTexts: string[]): number {
  if (sourceTexts.length === 0) return 0;
  const completeness = sourceTexts.reduce((total, source) => {
    const wordCount = source.trim().split(/\s+/).filter(Boolean).length;
    return total + clamp(wordCount / 8, 0, 1);
  }, 0) / sourceTexts.length;
  return Math.round(completeness * 100);
}

/**
 * Deterministic input-completeness score. The weights add to 100 and are
 * intentionally independent from the model's conclusions:
 *   document completeness 30, question sample 25, syllabus 20,
 *   course outcomes 15, historical evidence 10.
 * This was historically labelled "confidence"; it measures how much evidence
 * the analysis had, not whether the analysis is right.
 */
export function calculateEvidenceSufficiency(evidence: ConfidenceEvidence): {
  evidenceSufficiency: number;
  breakdown: EvidenceBreakdown;
  note: string;
} {
  const documentCompleteness = clamp(evidence.documentCompleteness, 0, 100);
  const questionsAnalyzed = Math.max(0, Math.floor(evidence.questionsAnalyzed));
  const historicalQuestionCount = Math.max(0, Math.floor(evidence.historicalQuestionCount));
  const historicalExamCount = Math.max(0, Math.floor(evidence.historicalExamCount));

  const breakdown: EvidenceBreakdown = {
    documentCompleteness: Math.round(30 * (documentCompleteness / 100) * 10) / 10,
    questionSample: Math.round(25 * Math.min(questionsAnalyzed / 30, 1) * 10) / 10,
    syllabus: evidence.syllabusAvailable ? 20 : 0,
    courseOutcomes: evidence.courseOutcomesAvailable ? 15 : 0,
    history: Math.round((5 * Math.min(historicalQuestionCount / 30, 1) + 5 * Math.min(historicalExamCount / 3, 1)) * 10) / 10,
  };
  const evidenceSufficiency = Math.round(
    breakdown.documentCompleteness + breakdown.questionSample + breakdown.syllabus + breakdown.courseOutcomes + breakdown.history
  );

  const note = [
    `${documentCompleteness}% document completeness`,
    `${questionsAnalyzed} question${questionsAnalyzed === 1 ? "" : "s"} analyzed`,
    evidence.syllabusAvailable ? "syllabus available" : "syllabus unavailable",
    evidence.courseOutcomesAvailable ? "course outcomes available" : "course outcomes unavailable",
    historicalQuestionCount > 0
      ? `${historicalQuestionCount} historical question${historicalQuestionCount === 1 ? "" : "s"} across ${historicalExamCount} previous exam${historicalExamCount === 1 ? "" : "s"}`
      : "no historical questions available",
  ].join(", ");

  return { evidenceSufficiency, breakdown, note };
}

/** @deprecated Use calculateEvidenceSufficiency; kept so v1 callers/tests keep working. */
export function calculateConfidence(evidence: ConfidenceEvidence): ConfidenceCalculation {
  const { evidenceSufficiency, note } = calculateEvidenceSufficiency(evidence);
  return { confidence: evidenceSufficiency, reason: note };
}

export interface ReliabilityInputs {
  /** From self-consistency sampling; null/undefined when k = 1. */
  agreement?: AgreementSummary | null;
  /** Best embedding cosine (0-1) behind a similarity result; model-free. */
  retrievalSupport?: number | null;
}

/**
 * Replaces model-authored confidence with two honest numbers. The model's
 * reason text is preserved verbatim; the arithmetic goes into structured fields
 * and a separate `reliabilityNote` (rendered by the PDF).
 */
export function applyCalculatedConfidence(
  explanation: AIExplanationResult,
  evidence: ConfidenceEvidence,
  reliability: ReliabilityInputs = {}
): AIExplanationResult {
  const { evidenceSufficiency, breakdown, note } = calculateEvidenceSufficiency(evidence);
  const agreement = reliability.agreement ?? null;
  // A single run must never claim agreement: null, never a defaulted 100.
  const modelAgreement = agreement && agreement.sampleCount > 1 ? agreement.agreement : null;
  const confidence = Math.min(evidenceSufficiency, modelAgreement ?? evidenceSufficiency);
  const agreementNote = modelAgreement === null
    ? "Model agreement not measured (single run)."
    : `Model agreement ${modelAgreement}/100 across ${agreement!.sampleCount} independent samples${agreement!.has_high_discrepancy ? " — high discrepancy, review recommended" : ""}.`;
  return {
    decision: explanation.decision.trim(),
    reason: explanation.reason.trim(),
    confidence,
    evidenceSufficiency,
    evidenceBreakdown: breakdown,
    modelAgreement,
    sampleCount: agreement?.sampleCount ?? 1,
    retrievalSupport: reliability.retrievalSupport === undefined || reliability.retrievalSupport === null
      ? null
      : Math.round(reliability.retrievalSupport * 100),
    reliabilityNote: `Evidence sufficiency ${evidenceSufficiency}/100 is based on ${note}. ${agreementNote}`,
    reliabilityVersion: 2,
  };
}

export function defaultConfidenceEvidence(sourceTexts: string[]): ConfidenceEvidence {
  return {
    documentCompleteness: calculateDocumentCompleteness(sourceTexts),
    questionsAnalyzed: sourceTexts.length,
    syllabusAvailable: false,
    courseOutcomesAvailable: false,
    historicalQuestionCount: 0,
    historicalExamCount: 0,
  };
}

/** Makes the required decision/reason/confidence contract available at response root. */
export function withDecisionContract<T extends { explanation: AIExplanationResult }>(
  result: T
): T & AIExplanationResult {
  return {
    ...result,
    decision: result.explanation.decision,
    reason: result.explanation.reason,
    confidence: result.explanation.confidence,
    evidenceSufficiency: result.explanation.evidenceSufficiency,
    modelAgreement: result.explanation.modelAgreement,
    reliabilityVersion: result.explanation.reliabilityVersion,
  };
}
