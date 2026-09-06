import { AppError } from "../../middleware/error.middleware";
import { QuestionReviewResult } from "../../models/types";
import { buildQuestionReviewPrompt, QUESTION_REVIEW_SYSTEM_PROMPT } from "../prompts/questionReview.prompt";
import { questionReviewResponseSchema } from "../schemas/analysisResponse.schema";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { callValidatedLlmJson } from "../validatedLlm";

export async function runQuestionReviewPipeline(
  questions: Array<{ id: number; text: string; marks: number }>,
  evidence?: ConfidenceEvidence
) {
  const parsed = await callValidatedLlmJson(
    QUESTION_REVIEW_SYSTEM_PROMPT,
    buildQuestionReviewPrompt(questions),
    questionReviewResponseSchema,
    "question-review"
  );
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
