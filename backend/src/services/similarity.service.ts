import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { reportRepository } from "../repositories/report.repository";
import { runSimilarityPipeline } from "../ai/pipeline/similarityPipeline";
import { AppError } from "../middleware/error.middleware";
import { AnalyzeSimilarityInput } from "../validators/analysis.validator";
import { courseRepository } from "../repositories/course.repository";
import { loadReliabilityEvidence } from "./analysisContext.service";
import { withDecisionContract } from "../ai/confidence";

export const similarityService = {
  async analyze(facultyId: number, input: AnalyzeSimilarityInput) {
    const course = await courseRepository.findOwnedById(input.courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);
    const currentPaper = await documentRepository.findQuestionPaperById(input.currentPaperId);
    const previousPaper = await documentRepository.findQuestionPaperById(input.previousPaperId);

    if (!currentPaper || currentPaper.courseId !== input.courseId) {
      throw new AppError("Current question paper not found for this course", 404);
    }
    if (!previousPaper || previousPaper.courseId !== input.courseId) {
      throw new AppError("Previous question paper not found for this course", 404);
    }

    const currentQuestions = await questionRepository.findByPaperId(currentPaper.id);
    const previousQuestions = await questionRepository.findByPaperId(previousPaper.id);
    const evidence = await loadReliabilityEvidence(input.courseId, {
      sourceTexts: currentQuestions.map((question) => question.questionText),
      analyzedQuestionCount: currentQuestions.length + previousQuestions.length,
      excludedQuestionIds: currentQuestions.map((question) => question.id),
      historicalQuestions: previousQuestions.map((question) => ({
        text: question.questionText,
        semester: previousPaper.semester,
        year: previousPaper.year,
      })),
    });

    const result = await runSimilarityPipeline(
      currentQuestions.map((q) => ({ id: q.id, text: q.questionText })),
      previousQuestions.map((q) => ({ id: q.id, text: q.questionText })),
      evidence
    );
    const completeResult = withDecisionContract(result);

    const report = await reportRepository.createExplainable(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId: currentPaper.id,
        reportType: "QUESTION_SIMILARITY",
        resultJson: completeResult,
      },
      [{ message: result.recommendation, priority: "MEDIUM" }],
      result.explanation
    );

    return { reportId: report.id, ...completeResult };
  },
};
