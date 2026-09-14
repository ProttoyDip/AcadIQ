import { AppError } from "../../middleware/error.middleware";
import { QuestionReviewResult } from "../../models/types";
import { QUESTION_REVIEW_PROMPT } from "../prompts/questionReview.prompt";
import { questionReviewResponseSchema } from "../schemas/analysisResponse.schema";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { runLlmAnalysis } from "../runner";

/**
 * Full review objects are long free-text rewrites at max_tokens 8192 — never
 * sampled (design B1). Bloom-level stability comes from bloomLabelPipeline instead.
 */
export async function runQuestionReviewPipeline(
  questions: Array<{ id: number; text: string; marks: number }>,
  evidence?: ConfidenceEvidence
) {
  const { consensus: parsed } = await runLlmAnalysis(QUESTION_REVIEW_PROMPT, [questions], questionReviewResponseSchema);
  const allowedIds = new Set(questions.map((question) => question.id));
  if (
    parsed.questions.some((question) => !allowedIds.has(question.questionId)) ||
    parsed.issues.some((issue) => issue.questionId !== undefined && !allowedIds.has(issue.questionId))
  ) {
    throw new AppError("AI response referenced an unknown question", 502);
  }
  const reliability = evidence ?? defaultConfidenceEvidence(questions.map((question) => question.text));
  const explanation = applyCalculatedConfidence(parsed.explanation, reliability);
  return {
    ...parsed,
    questions: parsed.questions.map((question) => ({ ...question, confidence: explanation.confidence })),
    explanation,
  } as QuestionReviewResult;
}
