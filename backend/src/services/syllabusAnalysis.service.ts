import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { reportRepository } from "../repositories/report.repository";
import { runSyllabusCoveragePipeline } from "../ai/pipeline/syllabusPipeline";
import { extractTextFromPdf } from "../utils/pdfParser";
import { AppError } from "../middleware/error.middleware";
import { AnalyzeSyllabusInput } from "../validators/analysis.validator";
import { Prisma } from "@prisma/client";

export const syllabusAnalysisService = {
  async analyze(facultyId: number, input: AnalyzeSyllabusInput) {
    const syllabus = await documentRepository.findLatestSyllabus(input.courseId);
    if (!syllabus) {
      throw new AppError("Upload a syllabus for this course before running coverage analysis", 400);
    }

    const paper = await documentRepository.findQuestionPaperById(input.questionPaperId);
    if (!paper || paper.courseId !== input.courseId) {
      throw new AppError("Question paper not found for this course", 404);
    }

    const syllabusText = await extractTextFromPdf(syllabus.filePath);
    const questions = await questionRepository.findByPaperId(paper.id);
    const questionsText = questions.map((q) => `- ${q.questionText}`).join("\n");

    const result = await runSyllabusCoveragePipeline(syllabusText, questionsText);

    const report = await reportRepository.create({
      facultyId,
      reportType: "SYLLABUS_COVERAGE",
      resultJson: result as unknown as Prisma.InputJsonValue,
    });

    return { reportId: report.id, ...result };
  },
};
