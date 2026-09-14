import { AppError } from "../../middleware/error.middleware";
import { CoMappingResult } from "../../models/types";
import { CO_MAPPING_PROMPT } from "../prompts/coMapping.prompt";
import { coMappingResponseSchema } from "../schemas/analysisResponse.schema";
import { applyCalculatedConfidence, ConfidenceEvidence, defaultConfidenceEvidence } from "../confidence";
import { aggregateLabels } from "../aggregate";
import { runLlmAnalysis } from "../runner";
import { PipelineOptions } from "./options";

export async function runCoMappingPipeline(
  syllabusText: string,
  questions: Array<{ id: number; text: string; marks: number }>,
  outcomes?: Array<{ code: string; description: string }>,
  evidence?: ConfidenceEvidence,
  options: PipelineOptions = {}
) {
  const run = await runLlmAnalysis(CO_MAPPING_PROMPT, [syllabusText, questions, outcomes], coMappingResponseSchema, {
    reliability: options.reliability,
    // Vote per question on the mapped outcome; the sample agreeing most with the modal labels supplies prose.
    aggregate: (samples) => {
      const labelSets = samples.map((s) => Object.fromEntries(s.questionCOMap.map((m) => [String(m.questionId), m.courseOutcome])));
      const { consensus: modal, agreement } = aggregateLabels(labelSets);
      let best = 0;
      let bestMatches = -1;
      samples.forEach((sample, index) => {
        const matches = sample.questionCOMap.filter((m) => modal[String(m.questionId)] === m.courseOutcome).length;
        if (matches > bestMatches) {
          bestMatches = matches;
          best = index;
        }
      });
      return { consensus: samples[best], agreement };
    },
  });
  const parsed = run.consensus;
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
  const explanation = applyCalculatedConfidence(parsed.explanation, reliability, { agreement: run.agreement });
  const votes = run.agreement?.votes ?? {};
  return {
    ...parsed,
    questionCOMap: parsed.questionCOMap.map((mapping) => ({
      ...mapping,
      confidence: explanation.confidence,
      votes: votes[String(mapping.questionId)],
      modelAgreement: explanation.modelAgreement,
      evidenceSufficiency: explanation.evidenceSufficiency,
    })),
    explanation,
  } as CoMappingResult;
}
