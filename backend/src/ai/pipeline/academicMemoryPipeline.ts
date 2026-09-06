import { AppError } from "../../middleware/error.middleware";
import { AcademicMemoryResult } from "../../models/types";
import { buildAcademicMemoryPrompt, ACADEMIC_MEMORY_SYSTEM_PROMPT } from "../prompts/academicMemory.prompt";
import { academicMemoryResponseSchema } from "../schemas/analysisResponse.schema";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { callValidatedLlmJson } from "../validatedLlm";

export async function runAcademicMemoryPipeline(
  newQuestions: Array<{ id: number; text: string }>,
  historicalQuestions: Array<{ id: number; text: string; semester: string; year: number }>,
  threshold: number,
  evidence?: ConfidenceEvidence
): Promise<AcademicMemoryResult> {
  const parsed = await callValidatedLlmJson(
    ACADEMIC_MEMORY_SYSTEM_PROMPT,
    buildAcademicMemoryPrompt(newQuestions, historicalQuestions, threshold),
    academicMemoryResponseSchema,
    "academic-memory"
  );

  const newIds = new Set(newQuestions.map((question) => question.id));
  const historicalIds = new Set(historicalQuestions.map((question) => question.id));
  if (parsed.similarQuestions.some((match) =>
    !newIds.has(match.newQuestionId) ||
    !historicalIds.has(match.historicalQuestionId) ||
    match.similarityScore < threshold
  )) {
    throw new AppError("AI response referenced an unknown question or ignored the similarity threshold", 502);
  }
  const reliability = evidence ?? defaultConfidenceEvidence([
    ...newQuestions.map((question) => question.text),
    ...historicalQuestions.map((question) => question.text),
  ]);
  const explanation = applyCalculatedConfidence(parsed.explanation, reliability);
  return {
    ...parsed,
    similarQuestions: parsed.similarQuestions.map((match) => ({ ...match, confidence: explanation.confidence })),
    explanation,
  };
}
