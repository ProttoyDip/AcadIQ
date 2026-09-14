import { AppError } from "../../middleware/error.middleware";
import { BloomLevel } from "../../models/types";
import { aggregateLabels, AgreementSummary } from "../aggregate";
import { BLOOM_LABEL_PROMPT } from "../prompts/questionReview.prompt";
import { runLlmAnalysis } from "../runner";
import { bloomLabelResponseSchema } from "../schemas/analysisResponse.schema";
import { PipelineOptions } from "./options";

export interface BloomLabel {
  questionId: number;
  bloomLevel: BloomLevel;
  topic: string;
  votes?: string;
  contested?: boolean;
}

export interface BloomLabelResult {
  labels: BloomLabel[];
  agreement: AgreementSummary | null;
}

/**
 * Tiny-output labelling prompt. Because each response is a handful of tokens,
 * k=3 here is cheaper than one full question review — this is the pipeline that
 * writes Question.bloomLevel / Question.topic.
 */
export async function runBloomLabelPipeline(
  questions: Array<{ id: number; text: string }>,
  options: PipelineOptions = {}
): Promise<BloomLabelResult> {
  if (!questions.length) return { labels: [], agreement: null };
  const run = await runLlmAnalysis(BLOOM_LABEL_PROMPT, [questions], bloomLabelResponseSchema, {
    reliability: options.reliability,
    aggregate: (samples) => {
      const { consensus: modal, agreement } = aggregateLabels(
        samples.map((s) => Object.fromEntries(s.labels.map((l) => [String(l.questionId), l.bloomLevel])))
      );
      // Topic is free text: take it from the first sample that agrees with the modal Bloom level.
      const labels = Object.entries(modal).map(([id, bloomLevel]) => {
        const match = samples.flatMap((s) => s.labels).find((l) => String(l.questionId) === id && l.bloomLevel === bloomLevel);
        return { questionId: Number(id), bloomLevel, topic: match?.topic ?? "" };
      });
      return { consensus: { labels }, agreement };
    },
  });

  const allowed = new Set(questions.map((q) => q.id));
  if (run.consensus.labels.some((label) => !allowed.has(label.questionId))) {
    throw new AppError("AI response referenced an unknown question", 502);
  }
  const votes = run.agreement?.votes ?? {};
  const contested = new Set(run.agreement?.contested ?? []);
  return {
    labels: run.consensus.labels.map((label) => ({
      ...label,
      votes: votes[String(label.questionId)],
      contested: contested.has(String(label.questionId)) || undefined,
    })),
    agreement: run.agreement,
  };
}
