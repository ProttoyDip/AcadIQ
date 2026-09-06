import { buildSimilarityUserPrompt, QUESTION_SIMILARITY_SYSTEM_PROMPT } from "../prompts/similarity.prompt";
import { questionSimilarityResponseSchema } from "../schemas/analysisResponse.schema";
import { QuestionSimilarityResult } from "../../models/types";
import { AppError } from "../../middleware/error.middleware";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { callValidatedLlmJson } from "../validatedLlm";

export async function runSimilarityPipeline(
  currentQuestions: { id: number; text: string }[],
  previousQuestions: { id: number; text: string }[],
  evidence?: ConfidenceEvidence
): Promise<QuestionSimilarityResult> {
  const parsed = await callValidatedLlmJson(
    QUESTION_SIMILARITY_SYSTEM_PROMPT,
    buildSimilarityUserPrompt(currentQuestions, previousQuestions),
    questionSimilarityResponseSchema,
    "question-similarity"
  );

  const currentIds = new Set(currentQuestions.map((question) => question.id));
  const previousIds = new Set(previousQuestions.map((question) => question.id));
  if (parsed.matches.some((match) =>
    !currentIds.has(match.currentQuestionId) || !previousIds.has(match.previousQuestionId)
  )) {
    throw new AppError("AI response referenced an unknown question", 502);
  }

  const reliability = evidence ?? defaultConfidenceEvidence([
    ...currentQuestions.map((question) => question.text),
    ...previousQuestions.map((question) => question.text),
  ]);
  const explanation = applyCalculatedConfidence(parsed.explanation, reliability);
  return {
    ...parsed,
    matches: parsed.matches.map((match) => ({ ...match, confidence: explanation.confidence })),
    explanation,
  };
}
