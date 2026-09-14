import { SYLLABUS_COVERAGE_PROMPT } from "../prompts/syllabusAnalysis.prompt";
import { syllabusCoverageResponseSchema } from "../schemas/analysisResponse.schema";
import { SyllabusCoverageResult } from "../../models/types";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { runLlmAnalysis } from "../runner";

/** Long-in/long-out: never sampled (design B1), so no reliability option is exposed. */
export async function runSyllabusCoveragePipeline(
  syllabusText: string,
  questionsText: string,
  evidence?: ConfidenceEvidence
): Promise<SyllabusCoverageResult> {
  const run = await runLlmAnalysis(SYLLABUS_COVERAGE_PROMPT, [syllabusText, questionsText], syllabusCoverageResponseSchema);
  const reliability = evidence ?? defaultConfidenceEvidence([questionsText]);
  return { ...run.consensus, explanation: applyCalculatedConfidence(run.consensus.explanation, reliability) };
}
