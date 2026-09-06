import { buildExamAnalysisUserPrompt, EXAM_ANALYSIS_SYSTEM_PROMPT } from "../prompts/examAnalysis.prompt";
import { examQualityResponseSchema } from "../schemas/analysisResponse.schema";
import { ExamQualityResult } from "../../models/types";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { callValidatedLlmJson } from "../validatedLlm";

export async function runExamAnalysisPipeline(
  syllabusText: string,
  questionsText: string,
  courseOutcomes: Array<{ code: string; description: string }>,
  evidence?: ConfidenceEvidence
): Promise<ExamQualityResult> {
  const parsed = await callValidatedLlmJson(
    EXAM_ANALYSIS_SYSTEM_PROMPT,
    buildExamAnalysisUserPrompt(syllabusText, questionsText, courseOutcomes),
    examQualityResponseSchema,
    "exam-quality"
  );
  const reliability = evidence ?? defaultConfidenceEvidence([questionsText]);
  return { ...parsed, explanation: applyCalculatedConfidence(parsed.explanation, reliability) };
}
