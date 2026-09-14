import { api } from "./api";
import {
  ExamQualityResult,
  SyllabusCoverageResult,
  QuestionSimilarityResult,
  QuestionReviewResult,
  CoMappingResult,
  FullAnalysisResult,
  ReliabilityMode,
} from "../types";

export interface CourseOutcomeInput {
  code: string;
  description: string;
}

export const analysisService = {
  analyzeExam: (courseId: number, questionPaperId: number, reliability?: ReliabilityMode) =>
    api.post<{ data: ExamQualityResult }>("/analysis/exam", { courseId, questionPaperId, reliability }).then((r) => r.data.data),

  analyzeSyllabus: (courseId: number, questionPaperId: number) =>
    api
      .post<{ data: SyllabusCoverageResult }>("/analysis/syllabus", { courseId, questionPaperId })
      .then((r) => r.data.data),

  analyzeSimilarity: (courseId: number, currentPaperId: number, previousPaperId: number, reliability?: ReliabilityMode) =>
    api
      .post<{ data: QuestionSimilarityResult }>("/analysis/similarity", { courseId, currentPaperId, previousPaperId, reliability })
      .then((r) => r.data.data),

  reviewQuestions: (courseId: number, questionPaperId: number, reliability?: ReliabilityMode) =>
    api
      .post<{ data: QuestionReviewResult }>("/analysis/question-review", { courseId, questionPaperId, reliability })
      .then((r) => r.data.data),

  mapCourseOutcomes: (courseId: number, questionPaperId: number, courseOutcomes?: CourseOutcomeInput[], reliability?: ReliabilityMode) =>
    api
      .post<{ data: CoMappingResult }>("/analysis/co-mapping", { courseId, questionPaperId, courseOutcomes, reliability })
      .then((r) => r.data.data),

  analyzeFull: (courseId: number, questionPaperId: number) =>
    api
      .post<{ data: FullAnalysisResult }>("/analysis/full", { courseId, questionPaperId })
      .then((r) => r.data.data),
};
