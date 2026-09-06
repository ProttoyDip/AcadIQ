import { callLlmJson } from "../llmClient";
import { buildExamAnalysisUserPrompt, EXAM_ANALYSIS_SYSTEM_PROMPT } from "../prompts/examAnalysis.prompt";
import { examQualityResponseSchema } from "../schemas/analysisResponse.schema";
import { ExamQualityResult } from "../../models/types";
import { AppError } from "../../middleware/error.middleware";

export async function runExamAnalysisPipeline(
  syllabusText: string,
  questionsText: string,
  courseOutcomes: Array<{ code: string; description: string }>
): Promise<ExamQualityResult> {
  const raw = await callLlmJson<unknown>(
    EXAM_ANALYSIS_SYSTEM_PROMPT,
    buildExamAnalysisUserPrompt(syllabusText, questionsText, courseOutcomes)
  );

  const parsed = examQualityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("AI response failed validation", 502, parsed.error.flatten());
  }

  return parsed.data;
}
