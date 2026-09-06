import { extractDocumentText } from "../ai/documentTextExtractor";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { memoryRepository } from "../repositories/memory.repository";
import { calculateDocumentCompleteness, ConfidenceEvidence } from "../ai/confidence";

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
  return extractDocumentText(syllabus.filePath, syllabus.mimeType);
}

interface ReliabilityOptions {
  sourceTexts: string[];
  analyzedQuestionCount?: number;
  excludedQuestionIds?: number[];
  syllabusText?: string;
  syllabusAvailable?: boolean;
  courseOutcomeCount?: number;
  historicalQuestions?: Array<{ text: string; semester: string; year: number }>;
}

/** Loads the five auditable inputs used by every server-side confidence score. */
export async function loadReliabilityEvidence(
  courseId: number,
  options: ReliabilityOptions
): Promise<ConfidenceEvidence> {
  const [syllabus, outcomes, storedHistory] = await Promise.all([
    options.syllabusAvailable === undefined && options.syllabusText === undefined
      ? documentRepository.findLatestSyllabus(courseId)
      : Promise.resolve(undefined),
    options.courseOutcomeCount === undefined
      ? courseRepository.findOutcomes(courseId)
      : Promise.resolve(undefined),
    options.historicalQuestions === undefined
      ? memoryRepository.findHistoricalQuestions(courseId, options.excludedQuestionIds ?? [])
      : Promise.resolve(undefined),
  ]);

  const history = options.historicalQuestions ?? storedHistory!.map((question) => ({
    text: question.questionText,
    semester: question.semester,
    year: question.year,
  }));
  const historicalExams = new Set(history.map((question) => `${question.year}:${question.semester}`));
  const completenessSources = [
    ...options.sourceTexts,
    ...(options.syllabusText ? [options.syllabusText] : []),
    ...history.map((question) => question.text),
  ];

  return {
    documentCompleteness: calculateDocumentCompleteness(completenessSources),
    questionsAnalyzed: options.analyzedQuestionCount ?? options.sourceTexts.length,
    syllabusAvailable: options.syllabusAvailable ?? Boolean(options.syllabusText?.trim() || syllabus),
    courseOutcomesAvailable: (options.courseOutcomeCount ?? outcomes!.length) > 0,
    historicalQuestionCount: history.length,
    historicalExamCount: historicalExams.size,
  };
}
