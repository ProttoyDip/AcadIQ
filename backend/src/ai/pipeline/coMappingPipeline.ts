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
  const referencedIds = [...parsed.data.questionCOMap.map((item) => item.questionId), ...parsed.data.unmappedQuestionIds];
  if (referencedIds.some((id) => !allowedIds.has(id))) throw new AppError("AI response referenced an unknown question", 502);
  if (outcomes) {
    const allowedOutcomes = new Set(outcomes.map((outcome) => outcome.code));
    const referencedOutcomes = [
      ...parsed.data.courseOutcomes.map((outcome) => outcome.code),
      ...Object.keys(parsed.data.coverage),
      ...parsed.data.questionCOMap.map((item) => item.courseOutcome),
      ...parsed.data.missingOutcomes,
    ];
    if (referencedOutcomes.some((code) => !allowedOutcomes.has(code))) {
      throw new AppError("AI response referenced an unknown course outcome", 502);
    }
    const suppliedDescriptions = new Map(outcomes.map((outcome) => [outcome.code, outcome.description]));
    if (parsed.data.courseOutcomes.some((outcome) => suppliedDescriptions.get(outcome.code) !== outcome.description)) {
      throw new AppError("AI response altered a supplied course outcome", 502);
    }
  }
  const analyzedOutcomeCodes = new Set(parsed.data.courseOutcomes.map((outcome) => outcome.code));
  if (analyzedOutcomeCodes.size !== parsed.data.courseOutcomes.length) {
    throw new AppError("AI response contains duplicate course outcomes", 502);
  }
  const allOutputCodes = [
    ...Object.keys(parsed.data.coverage),
    ...parsed.data.questionCOMap.map((item) => item.courseOutcome),
    ...parsed.data.missingOutcomes,
  ];
  if (allOutputCodes.some((code) => !analyzedOutcomeCodes.has(code))) {
    throw new AppError("AI response contains inconsistent course outcome references", 502);
  }
  return parsed.data as CoMappingResult;
}
