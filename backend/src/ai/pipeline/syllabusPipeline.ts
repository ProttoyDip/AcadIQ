import { callLlmJson } from "../llmClient";
import { buildSyllabusCoverageUserPrompt, SYLLABUS_COVERAGE_SYSTEM_PROMPT } from "../prompts/syllabusAnalysis.prompt";
import { syllabusCoverageResponseSchema } from "../schemas/analysisResponse.schema";
import { SyllabusCoverageResult } from "../../models/types";
import { AppError } from "../../middleware/error.middleware";

export async function runSyllabusCoveragePipeline(
  syllabusText: string,
  questionsText: string
): Promise<SyllabusCoverageResult> {
  const raw = await callLlmJson<unknown>(
    SYLLABUS_COVERAGE_SYSTEM_PROMPT,
    buildSyllabusCoverageUserPrompt(syllabusText, questionsText)
  );

  const parsed = syllabusCoverageResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("AI response failed validation", 502, parsed.error.flatten());
  }

  return parsed.data;
}
