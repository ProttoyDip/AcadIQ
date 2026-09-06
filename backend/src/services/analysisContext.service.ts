import { extractPdfText } from "../ai/pdfTextExtractor";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";

export async function loadAnalysisContext(facultyId: number, courseId: number, questionPaperId: number) {
  const course = await courseRepository.findOwnedById(courseId, facultyId);
  if (!course) throw new AppError("Course not found", 404);

  const paper = await documentRepository.findQuestionPaperById(questionPaperId);
  if (!paper || paper.courseId !== courseId) {
    throw new AppError("Question paper not found for this course", 404);
  }

  const questions = await questionRepository.findByPaperId(paper.id);
  if (questions.length === 0) throw new AppError("The question paper contains no extracted questions", 422);
  return { course, paper, questions };
}

export async function loadSyllabusText(courseId: number) {
  const syllabus = await documentRepository.findLatestSyllabus(courseId);
  if (!syllabus) {
    throw new AppError("Upload a syllabus for this course before running this analysis", 400);
  }
  return extractPdfText(syllabus.filePath);
}
