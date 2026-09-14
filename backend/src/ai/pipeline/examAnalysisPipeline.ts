import { EXAM_ANALYSIS_PROMPT } from "../prompts/examAnalysis.prompt";
import { examQualityResponseSchema } from "../schemas/analysisResponse.schema";
import { ExamQualityResult } from "../../models/types";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { aggregateNumeric } from "../aggregate";
import { runLlmAnalysis } from "../runner";
import { PipelineOptions } from "./options";

export async function runExamAnalysisPipeline(
  syllabusText: string,
  questionsText: string,
  courseOutcomes: Array<{ code: string; description: string }>,
  evidence?: ConfidenceEvidence,
  options: PipelineOptions = {}
): Promise<ExamQualityResult> {
  const run = await runLlmAnalysis(EXAM_ANALYSIS_PROMPT, [syllabusText, questionsText, courseOutcomes], examQualityResponseSchema, {
    reliability: options.reliability,
    // Median sample wins wholesale so scoreFactors stay consistent with its own qualityScore.
    aggregate: (samples) => {
      const { agreement, consensusIndex } = aggregateNumeric(samples.map((s) => s.qualityScore));
      return { consensus: samples[consensusIndex], agreement };
    },
  });
  const reliability = evidence ?? defaultConfidenceEvidence([questionsText]);
  return {
    ...run.consensus,
    qualityScoreSpread: run.agreement?.spread,
    explanation: applyCalculatedConfidence(run.consensus.explanation, reliability, { agreement: run.agreement }),
  };
}
