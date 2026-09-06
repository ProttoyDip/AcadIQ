import { AppError } from "../../middleware/error.middleware";
import { QuestionReviewResult } from "../../models/types";
import { callLlmJson } from "../llmClient";
import { buildQuestionReviewPrompt, QUESTION_REVIEW_SYSTEM_PROMPT } from "../prompts/questionReview.prompt";
import { questionReviewResponseSchema } from "../schemas/analysisResponse.schema";

export async function runQuestionReviewPipeline(questions: Array<{ id: number; text: string; marks: number }>) {
  const raw = await callLlmJson<unknown>(QUESTION_REVIEW_SYSTEM_PROMPT, buildQuestionReviewPrompt(questions));
  const parsed = questionReviewResponseSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("AI response failed validation", 502, parsed.error.flatten());
  const allowedIds = new Set(questions.map((question) => question.id));
  if (
    parsed.data.questions.some((question) => !allowedIds.has(question.questionId)) ||
    parsed.data.issues.some((issue) => issue.questionId !== undefined && !allowedIds.has(issue.questionId))
  ) {
    throw new AppError("AI response referenced an unknown question", 502);
  }
  return parsed.data as QuestionReviewResult;
}
