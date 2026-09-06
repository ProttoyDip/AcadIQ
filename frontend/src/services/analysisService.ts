import { api } from "./api";

export const analysisService = {
  analyzeExam: (courseId: number, questionPaperId: number) =>
    api.post("/analyze/exam", { courseId, questionPaperId }).then((r) => r.data.data),

  analyzeSyllabus: (courseId: number, questionPaperId: number) =>
    api.post("/analyze/syllabus", { courseId, questionPaperId }).then((r) => r.data.data),

  analyzeSimilarity: (courseId: number, currentPaperId: number, previousPaperId: number) =>
    api.post("/analyze/similarity", { courseId, currentPaperId, previousPaperId }).then((r) => r.data.data),
};
