import { AppError } from "../../middleware/error.middleware";
import { CoMappingResult } from "../../models/types";
import { callLlmJson } from "../llmClient";
import { buildCoMappingPrompt, CO_MAPPING_SYSTEM_PROMPT } from "../prompts/coMapping.prompt";
import { coMappingResponseSchema } from "../schemas/analysisResponse.schema";

export async function runCoMappingPipeline(
  syllabusText: string,
  questions: Array<{ id: number; text: string; marks: number }>,
  outcomes?: Array<{ code: string; description: string }>
) {
  const raw = await callLlmJson<unknown>(CO_MAPPING_SYSTEM_PROMPT, buildCoMappingPrompt(syllabusText, questions, outcomes));
  const parsed = coMappingResponseSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("AI response failed validation", 502, parsed.error.flatten());
  const allowedIds = new Set(questions.map((question) => question.id));
  const referencedIds = [...parsed.data.mappings.map((item) => item.questionId), ...parsed.data.unmappedQuestionIds];
  if (referencedIds.some((id) => !allowedIds.has(id))) throw new AppError("AI response referenced an unknown question", 502);
  if (outcomes) {
    const allowedOutcomes = new Set(outcomes.map((outcome) => outcome.code));
    const referencedOutcomes = [
      ...Object.keys(parsed.data.coverage),
      ...parsed.data.mappings.map((item) => item.courseOutcome),
    ];
    if (referencedOutcomes.some((code) => !allowedOutcomes.has(code))) {
      throw new AppError("AI response referenced an unknown course outcome", 502);
    }
  }
  return parsed.data as CoMappingResult;
}
