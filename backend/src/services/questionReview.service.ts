import { runQuestionReviewPipeline } from "../ai/pipeline/questionReviewPipeline";
import { reportRepository } from "../repositories/report.repository";
import { QuestionReviewInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadReliabilityEvidence } from "./analysisContext.service";
import { AppError } from "../middleware/error.middleware";
import { withDecisionContract } from "../ai/confidence";

export const questionReviewService = {
  async analyze(facultyId: number, input: QuestionReviewInput) {
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
    const completeResult = withDecisionContract(result);
    const report = await reportRepository.createExplainable(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId: paper.id,
        reportType: "QUESTION_REVIEW",
        resultJson: completeResult,
      },
      result.recommendations.map((item) => ({ message: item.message, priority: item.priority })),
      result.explanation
    );
    return { reportId: report.id, ...completeResult };
  },
};
