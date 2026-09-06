import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { reportRepository } from "../repositories/report.repository";
import { runExamAnalysisPipeline } from "../ai/pipeline/examAnalysisPipeline";
import { extractTextFromPdf } from "../utils/pdfParser";
import { AppError } from "../middleware/error.middleware";
import { AnalyzeExamInput } from "../validators/analysis.validator";
import { Priority, Prisma } from "@prisma/client";

export const examAnalysisService = {
  async analyze(facultyId: number, input: AnalyzeExamInput) {
    const syllabus = await documentRepository.findLatestSyllabus(input.courseId);
    if (!syllabus) {
      throw new AppError("Upload a syllabus for this course before running exam analysis", 400);
    }

    const paper = await documentRepository.findQuestionPaperById(input.questionPaperId);
    if (!paper || paper.courseId !== input.courseId) {
      throw new AppError("Question paper not found for this course", 404);
    }

    const syllabusText = await extractTextFromPdf(syllabus.filePath);
    const questions = await questionRepository.findByPaperId(paper.id);
    const questionsText = questions.map((q) => `- ${q.questionText} [${q.marks} marks]`).join("\n");

    const result = await runExamAnalysisPipeline(syllabusText, questionsText);

    const report = await reportRepository.create({
      facultyId,
      reportType: "EXAM_QUALITY",
      resultJson: result as unknown as Prisma.InputJsonValue,
    });

    await reportRepository.addRecommendations(
      report.id,
      result.recommendations.map((r) => ({ message: r.message, priority: r.priority as Priority }))
    );

    return { reportId: report.id, ...result };
  },
};
