import { AppError } from "../../middleware/error.middleware";
import { CoMappingResult } from "../../models/types";
import { buildCoMappingPrompt, CO_MAPPING_SYSTEM_PROMPT } from "../prompts/coMapping.prompt";
import { coMappingResponseSchema } from "../schemas/analysisResponse.schema";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { callValidatedLlmJson } from "../validatedLlm";

export async function runCoMappingPipeline(
  syllabusText: string,
  questions: Array<{ id: number; text: string; marks: number }>,
  outcomes?: Array<{ code: string; description: string }>,
  evidence?: ConfidenceEvidence
) {
  const parsed = await callValidatedLlmJson(
    CO_MAPPING_SYSTEM_PROMPT,
    buildCoMappingPrompt(syllabusText, questions, outcomes),
    coMappingResponseSchema,
    "course-outcome-mapping"
  );
  const allowedIds = new Set(questions.map((question) => question.id));
  const referencedIds = [...parsed.questionCOMap.map((item) => item.questionId), ...parsed.unmappedQuestionIds];
  if (referencedIds.some((id) => !allowedIds.has(id))) throw new AppError("AI response referenced an unknown question", 502);
  if (outcomes) {
    const allowedOutcomes = new Set(outcomes.map((outcome) => outcome.code));
    const referencedOutcomes = [
      ...parsed.courseOutcomes.map((outcome) => outcome.code),
      ...Object.keys(parsed.coverage),
      ...parsed.questionCOMap.map((item) => item.courseOutcome),
      ...parsed.missingOutcomes,
    ];
    if (referencedOutcomes.some((code) => !allowedOutcomes.has(code))) {
      throw new AppError("AI response referenced an unknown course outcome", 502);
    }
    const suppliedDescriptions = new Map(outcomes.map((outcome) => [outcome.code, outcome.description]));
    if (parsed.courseOutcomes.some((outcome) => suppliedDescriptions.get(outcome.code) !== outcome.description)) {
      throw new AppError("AI response altered a supplied course outcome", 502);
    }
  }
  const analyzedOutcomeCodes = new Set(parsed.courseOutcomes.map((outcome) => outcome.code));
  if (analyzedOutcomeCodes.size !== parsed.courseOutcomes.length) {
    throw new AppError("AI response contains duplicate course outcomes", 502);
  }
  const allOutputCodes = [
    ...Object.keys(parsed.coverage),
    ...parsed.questionCOMap.map((item) => item.courseOutcome),
    ...parsed.missingOutcomes,
  ];
  if (allOutputCodes.some((code) => !analyzedOutcomeCodes.has(code))) {
    throw new AppError("AI response contains inconsistent course outcome references", 502);
  }
  const reliability = evidence ?? defaultConfidenceEvidence(questions.map((question) => question.text));
  const explanation = applyCalculatedConfidence(parsed.explanation, reliability);
  return {
    ...parsed,
    questionCOMap: parsed.questionCOMap.map((mapping) => ({ ...mapping, confidence: explanation.confidence })),
    explanation,
  } as CoMappingResult;
}
