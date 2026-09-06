import { buildSyllabusCoverageUserPrompt, SYLLABUS_COVERAGE_SYSTEM_PROMPT } from "../prompts/syllabusAnalysis.prompt";
import { syllabusCoverageResponseSchema } from "../schemas/analysisResponse.schema";
import { SyllabusCoverageResult } from "../../models/types";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { callValidatedLlmJson } from "../validatedLlm";

export async function runSyllabusCoveragePipeline(
  syllabusText: string,
  questionsText: string,
  evidence?: ConfidenceEvidence
): Promise<SyllabusCoverageResult> {
  const parsed = await callValidatedLlmJson(
    SYLLABUS_COVERAGE_SYSTEM_PROMPT,
    buildSyllabusCoverageUserPrompt(syllabusText, questionsText),
    syllabusCoverageResponseSchema,
    "syllabus-coverage"
  );
  const reliability = evidence ?? defaultConfidenceEvidence([questionsText]);
  return { ...parsed, explanation: applyCalculatedConfidence(parsed.explanation, reliability) };
}
