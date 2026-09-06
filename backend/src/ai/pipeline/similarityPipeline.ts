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

  return parsed.data;
}
