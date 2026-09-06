import { AIExplanationResult } from "../models/types";

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
 * Deterministic reliability score. The weights add to 100 and are intentionally
 * independent from the model's conclusions:
 *   document completeness 30, question sample 25, syllabus 20,
 *   course outcomes 15, historical evidence 10.
 */
export function calculateConfidence(evidence: ConfidenceEvidence): ConfidenceCalculation {
  const documentCompleteness = clamp(evidence.documentCompleteness, 0, 100);
  const questionsAnalyzed = Math.max(0, Math.floor(evidence.questionsAnalyzed));
  const historicalQuestionCount = Math.max(0, Math.floor(evidence.historicalQuestionCount));
  const historicalExamCount = Math.max(0, Math.floor(evidence.historicalExamCount));

  const documentPoints = 30 * (documentCompleteness / 100);
  const questionPoints = 25 * Math.min(questionsAnalyzed / 30, 1);
  const syllabusPoints = evidence.syllabusAvailable ? 20 : 0;
  const outcomePoints = evidence.courseOutcomesAvailable ? 15 : 0;
  const historyPoints = 5 * Math.min(historicalQuestionCount / 30, 1)
    + 5 * Math.min(historicalExamCount / 3, 1);
  const confidence = Math.round(
    documentPoints + questionPoints + syllabusPoints + outcomePoints + historyPoints
  );

  const reason = [
    `${documentCompleteness}% document completeness`,
    `${questionsAnalyzed} question${questionsAnalyzed === 1 ? "" : "s"} analyzed`,
    evidence.syllabusAvailable ? "syllabus available" : "syllabus unavailable",
    evidence.courseOutcomesAvailable ? "course outcomes available" : "course outcomes unavailable",
    historicalQuestionCount > 0
      ? `${historicalQuestionCount} historical question${historicalQuestionCount === 1 ? "" : "s"} across ${historicalExamCount} previous exam${historicalExamCount === 1 ? "" : "s"}`
      : "no historical questions available",
  ].join(", ");

  return { confidence, reason };
}

/** Replaces model-authored confidence with the reproducible evidence score. */
export function applyCalculatedConfidence(
  explanation: AIExplanationResult,
  evidence: ConfidenceEvidence
): AIExplanationResult {
  const calculated = calculateConfidence(evidence);
  return {
    decision: explanation.decision.trim(),
    reason: `${explanation.reason.trim()} Confidence ${calculated.confidence}/100 is based on ${calculated.reason}.`,
    confidence: calculated.confidence,
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
  };
}
