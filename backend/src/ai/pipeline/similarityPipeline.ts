import { callLlmJson } from "../llmClient";
import { buildSimilarityUserPrompt, QUESTION_SIMILARITY_SYSTEM_PROMPT } from "../prompts/similarity.prompt";
import { questionSimilarityResponseSchema } from "../schemas/analysisResponse.schema";
import { QuestionSimilarityResult } from "../../models/types";
import { AppError } from "../../middleware/error.middleware";

export async function runSimilarityPipeline(
  currentQuestions: { id: number; text: string }[],
  previousQuestions: { id: number; text: string }[]
): Promise<QuestionSimilarityResult> {
  const raw = await callLlmJson<unknown>(
    QUESTION_SIMILARITY_SYSTEM_PROMPT,
    buildSimilarityUserPrompt(currentQuestions, previousQuestions)
  );

  const parsed = questionSimilarityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("AI response failed validation", 502, parsed.error.flatten());
  }

  const currentIds = new Set(currentQuestions.map((question) => question.id));
  const previousIds = new Set(previousQuestions.map((question) => question.id));
  if (parsed.data.matches.some((match) =>
    !currentIds.has(match.currentQuestionId) || !previousIds.has(match.previousQuestionId)
  )) {
    throw new AppError("AI response referenced an unknown question", 502);
  }

  return parsed.data;
}
