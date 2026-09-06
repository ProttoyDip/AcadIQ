import { runAcademicMemoryPipeline } from "../ai/pipeline/academicMemoryPipeline";
import { AppError } from "../middleware/error.middleware";
import { AcademicMemoryResult } from "../models/types";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { memoryRepository } from "../repositories/memory.repository";
import { reportRepository } from "../repositories/report.repository";
import { MemoryCheckInput } from "../validators/analysis.validator";

export const academicMemoryService = {
  async check(facultyId: number, input: MemoryCheckInput) {
    const course = await courseRepository.findOwnedById(input.courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);

    let questionPaperId = input.questionPaperId;
    let newQuestions = input.newQuestions?.map((question, index) => ({ id: question.id ?? index + 1, text: question.text }));
    if (questionPaperId) {
      const paper = await documentRepository.findQuestionPaperById(questionPaperId);
      if (!paper || paper.courseId !== input.courseId) {
        throw new AppError("Question paper not found for this course", 404);
      }
      if (!newQuestions) {
        newQuestions = paper.questions.map((question) => ({ id: question.id, text: question.questionText }));
      }
    }
    if (!newQuestions?.length) throw new AppError("No new questions were supplied or extracted", 422);

    const excludedIds = questionPaperId ? newQuestions.map((question) => question.id) : [];
    const storedHistory = input.historicalQuestions
      ? undefined
      : await memoryRepository.findHistoricalQuestions(input.courseId, excludedIds);
    const historicalQuestions = input.historicalQuestions?.map((question, index) => ({
      id: question.id ?? index + 1,
      text: question.text,
      semester: question.semester,
      year: question.year,
    })) ?? storedHistory!.map((question) => ({
      id: question.id,
      text: question.questionText,
      semester: question.semester,
      year: question.year,
    }));

    const result: AcademicMemoryResult = historicalQuestions.length
      ? await runAcademicMemoryPipeline(newQuestions, historicalQuestions, input.similarityThreshold)
      : {
          similarQuestions: [],
          similarityScore: 0,
          replacementSuggestion: "No replacement is needed until historical questions are available for comparison.",
          explanation: {
            decision: "NO_HISTORY_AVAILABLE",
            reason: "The course has no earlier stored questions, so similarity cannot yet be assessed.",
            confidence: 100,
          },
        };

    if (!input.historicalQuestions && result.similarQuestions.length) {
      await memoryRepository.recordSimilarityScores(result.similarQuestions);
    }

    const newQuestionById = new Map(newQuestions.map((question) => [question.id, question.text]));
    const historicalById = new Map(historicalQuestions.map((question) => [question.id, question]));
    const completeResult = {
      ...result,
      similarQuestions: result.similarQuestions.map((match) => ({
        ...match,
        newQuestionText: newQuestionById.get(match.newQuestionId),
        historicalQuestionText: historicalById.get(match.historicalQuestionId)?.text,
        semester: historicalById.get(match.historicalQuestionId)?.semester,
        year: historicalById.get(match.historicalQuestionId)?.year,
      })),
    };
    const report = await reportRepository.createExplainable(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId,
        reportType: "ACADEMIC_MEMORY",
        resultJson: completeResult,
      },
      [{ message: result.replacementSuggestion, priority: result.similarityScore >= 80 ? "HIGH" : "MEDIUM" }],
      result.explanation
    );
    return { reportId: report.id, ...completeResult };
  },
};
