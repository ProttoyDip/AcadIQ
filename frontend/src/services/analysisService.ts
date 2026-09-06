import { api } from "./api";
import { ExamQualityResult, SyllabusCoverageResult, QuestionSimilarityResult } from "../types";

export const analysisService = {
  analyzeExam: (courseId: number, questionPaperId: number) =>
    api.post<{ data: ExamQualityResult }>("/analyze/exam", { courseId, questionPaperId }).then((r) => r.data.data),

  analyzeSyllabus: (courseId: number, questionPaperId: number) =>
    api
      .post<{ data: SyllabusCoverageResult }>("/analyze/syllabus", { courseId, questionPaperId })
      .then((r) => r.data.data),

  analyzeSimilarity: (courseId: number, currentPaperId: number, previousPaperId: number) =>
    api
      .post<{ data: QuestionSimilarityResult }>("/analyze/similarity", { courseId, currentPaperId, previousPaperId })
      .then((r) => r.data.data),
};
