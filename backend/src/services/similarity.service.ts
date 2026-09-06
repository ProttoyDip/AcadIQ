import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { reportRepository } from "../repositories/report.repository";
import { runSimilarityPipeline } from "../ai/pipeline/similarityPipeline";
import { AppError } from "../middleware/error.middleware";
import { AnalyzeSimilarityInput } from "../validators/analysis.validator";
import { Prisma } from "@prisma/client";

export const similarityService = {
  async analyze(facultyId: number, input: AnalyzeSimilarityInput) {
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

    const result = await runSimilarityPipeline(
      currentQuestions.map((q) => ({ id: q.id, text: q.questionText })),
      previousQuestions.map((q) => ({ id: q.id, text: q.questionText }))
    );

    const report = await reportRepository.create({
      facultyId,
      reportType: "QUESTION_SIMILARITY",
      resultJson: result as unknown as Prisma.InputJsonValue,
    });

    return { reportId: report.id, ...result };
  },
};
