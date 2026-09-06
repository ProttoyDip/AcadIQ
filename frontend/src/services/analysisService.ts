import { api } from "./api";
import { ExamQualityResult, SyllabusCoverageResult, QuestionSimilarityResult } from "../types";

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
};
