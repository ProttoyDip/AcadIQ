import { AppError } from "../../middleware/error.middleware";
import { AcademicMemoryResult } from "../../models/types";
import { callLlmJson } from "../llmClient";
import { buildAcademicMemoryPrompt, ACADEMIC_MEMORY_SYSTEM_PROMPT } from "../prompts/academicMemory.prompt";
import { academicMemoryResponseSchema } from "../schemas/analysisResponse.schema";

export async function runAcademicMemoryPipeline(
  newQuestions: Array<{ id: number; text: string }>,
  historicalQuestions: Array<{ id: number; text: string; semester: string; year: number }>,
  threshold: number
): Promise<AcademicMemoryResult> {
  const raw = await callLlmJson<unknown>(
    ACADEMIC_MEMORY_SYSTEM_PROMPT,
    buildAcademicMemoryPrompt(newQuestions, historicalQuestions, threshold)
  );
  const parsed = academicMemoryResponseSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("AI response failed validation", 502, parsed.error.flatten());

  const newIds = new Set(newQuestions.map((question) => question.id));
  const historicalIds = new Set(historicalQuestions.map((question) => question.id));
  if (parsed.data.similarQuestions.some((match) =>
    !newIds.has(match.newQuestionId) ||
    !historicalIds.has(match.historicalQuestionId) ||
    match.similarityScore < threshold
  )) {
    throw new AppError("AI response referenced an unknown question or ignored the similarity threshold", 502);
  }
  return parsed.data;
}
