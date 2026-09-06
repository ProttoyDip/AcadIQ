import { api } from "./api";
import {
  ExamQualityResult,
  SyllabusCoverageResult,
  QuestionSimilarityResult,
  QuestionReviewResult,
  CoMappingResult,
} from "../types";

export interface CourseOutcomeInput {
  code: string;
  description: string;
}

export const analysisService = {
  analyzeExam: (courseId: number, questionPaperId: number) =>
    api.post<{ data: ExamQualityResult }>("/analysis/exam", { courseId, questionPaperId }).then((r) => r.data.data),

  analyzeSyllabus: (courseId: number, questionPaperId: number) =>
    api
      .post<{ data: SyllabusCoverageResult }>("/analysis/syllabus", { courseId, questionPaperId })
      .then((r) => r.data.data),

  analyzeSimilarity: (courseId: number, currentPaperId: number, previousPaperId: number) =>
    api
      .post<{ data: QuestionSimilarityResult }>("/analysis/similarity", { courseId, currentPaperId, previousPaperId })
      .then((r) => r.data.data),

  reviewQuestions: (courseId: number, questionPaperId: number) =>
    api
      .post<{ data: QuestionReviewResult }>("/analysis/question-review", { courseId, questionPaperId })
      .then((r) => r.data.data),

  mapCourseOutcomes: (courseId: number, questionPaperId: number, courseOutcomes?: CourseOutcomeInput[]) =>
    api
      .post<{ data: CoMappingResult }>("/analysis/co-mapping", { courseId, questionPaperId, courseOutcomes })
      .then((r) => r.data.data),
};
