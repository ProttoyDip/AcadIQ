import { runQuestionReviewPipeline } from "../ai/pipeline/questionReviewPipeline";
import { runBloomLabelPipeline } from "../ai/pipeline/bloomLabelPipeline";
import { reportRepository } from "../repositories/report.repository";
import { questionRepository } from "../repositories/question.repository";
import { QuestionReviewInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadReliabilityEvidence } from "./analysisContext.service";
import { AppError } from "../middleware/error.middleware";
import { withDecisionContract } from "../ai/confidence";
import { tracedAnalysis } from "./traced";
import { logger } from "../utils/logger";

export const questionReviewService = {
  analyze(facultyId: number, input: QuestionReviewInput) {
    return tracedAnalysis(async () => {
      const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
      const requestedIds = input.questionIds ? new Set(input.questionIds) : undefined;
      const selected = requestedIds ? questions.filter((question) => requestedIds.has(question.id)) : questions;
      if (requestedIds && selected.length !== requestedIds.size) {
        throw new AppError("One or more questionIds do not belong to this question paper", 422);
      }

      const evidence = await loadReliabilityEvidence(input.courseId, {
        sourceTexts: selected.map((question) => question.questionText),
        excludedQuestionIds: questions.map((question) => question.id),
      });
      const result = await runQuestionReviewPipeline(
        selected.map((question) => ({ id: question.id, text: question.questionText, marks: Number(question.marks) })),
        evidence
      );

      // Bloom/topic labels come from the tiny label prompt (sampled when verified) and are written back to Question.
      let labels: Awaited<ReturnType<typeof runBloomLabelPipeline>> | null = null;
      try {
        labels = await runBloomLabelPipeline(
          selected.map((question) => ({ id: question.id, text: question.questionText })),
          { reliability: input.reliability }
        );
        await questionRepository.saveLabels(labels.labels);
      } catch (error) {
        logger.warn("bloom_label_failed", { paperId: paper.id, reason: error instanceof Error ? error.message : String(error) });
      }
      const labelById = new Map(labels?.labels.map((label) => [label.questionId, label]) ?? []);

      const completeResult = withDecisionContract({
        ...result,
        questions: result.questions.map((question) => {
          const label = labelById.get(question.questionId);
          return label
            ? { ...question, bloomLevel: label.bloomLevel, topic: label.topic, bloomVotes: label.votes, bloomContested: label.contested }
            : question;
        }),
        explanation: labels?.agreement
          ? {
              ...result.explanation,
              modelAgreement: labels.agreement.agreement,
              sampleCount: labels.agreement.sampleCount,
              agreementMode: labels.agreement.mode ?? "self-consistency",
              agreementModels: labels.agreement.models,
              confidence: Math.min(result.explanation.confidence, labels.agreement.agreement),
              // The review prompt itself is never sampled; agreement here comes from the Bloom-label votes.
              reliabilityNote: `${(result.explanation.reliabilityNote ?? "").replace(/\s*Model agreement not measured \(single run\)\.?/, "")} Bloom-level ${labels.agreement.mode === "cross-model" ? `cross-model agreement ${labels.agreement.agreement}/100 between ${(labels.agreement.models ?? []).join(" and ")}` : `agreement ${labels.agreement.agreement}/100 across ${labels.agreement.sampleCount} samples`}${labels.agreement.contested?.length ? ` (${labels.agreement.contested.length} contested)` : ""}.`.trim(),
            }
          : result.explanation,
        labelAgreement: labels?.agreement ?? null,
      });
      const report = await reportRepository.createExplainable(
        {
          facultyId,
          courseId: input.courseId,
          questionPaperId: paper.id,
          reportType: "QUESTION_REVIEW",
          resultJson: completeResult,
        },
        result.recommendations.map((item) => ({ message: item.message, priority: item.priority })),
        completeResult.explanation
      );
      return { reportId: report.id, ...completeResult };
    });
  },
};
