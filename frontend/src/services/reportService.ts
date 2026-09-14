import { api } from "./api";
import { AnalysisReport, FeedbackStats, GeneratedPaperResult, QuestionFeedback, QuestionPaper, ReportProvenance, ReproduceResult, UploadDuplicateWarning } from "../types";

export const reportService = {
  list: () => api.get<{ data: AnalysisReport[] }>("/reports").then((r) => r.data.data),
  getById: (id: number) => api.get<{ data: AnalysisReport }>(`/reports/${id}`).then((r) => r.data.data),
  provenance: (id: number) => api.get<{ data: ReportProvenance }>(`/reports/${id}/provenance`).then((r) => r.data.data),
  sample: (id: number, runId: number, sampleIndex: number) =>
    api.get<{ data: { rawResponse: string; validated: boolean } }>(`/reports/${id}/provenance/runs/${runId}/samples/${sampleIndex}`).then((r) => r.data.data),
  reproduce: (id: number) => api.post<{ data: ReproduceResult }>(`/reports/${id}/reproduce`).then((r) => r.data.data),
  feedbackForReport: (id: number) => api.get<{ data: QuestionFeedback[] }>(`/feedback/reports/${id}`).then((r) => r.data.data),
  submitFeedback: (payload: {
    questionId: number;
    reportId?: number;
    verdict: "UP" | "DOWN";
    aiBloomLevel?: string;
    correctedBloomLevel?: string;
    aiTopic?: string;
    correctedTopic?: string;
    note?: string;
  }) => api.post<{ data: QuestionFeedback }>("/feedback/questions", payload).then((r) => r.data.data),
  feedbackStats: (courseId?: number) =>
    api.get<{ data: FeedbackStats }>("/feedback/stats", { params: courseId ? { courseId } : undefined }).then((r) => r.data.data),
  generatePaper: (payload: {
    courseId: number;
    questionCount?: number;
    totalMarks?: number;
    targetBloom?: Record<string, number>;
    outcomeWeights?: Record<string, number>;
    passThreshold?: number;
    maxIterations?: number;
    materialIds?: number[];
    focus?: "taught" | "balanced" | "syllabus";
  }) => api.post<{ data: GeneratedPaperResult }>("/analysis/generate-paper", payload).then((r) => r.data.data),
  downloadPdf: async (id: number) => {
    const response = await api.get<Blob>(`/reports/${id}/pdf`, { responseType: "blob" });
    const disposition = String(response.headers["content-disposition"] ?? "");
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return { blob: response.data, filename: match?.[1] ?? `acadiq-report-${id}.pdf` };
  },
  /** Student-facing copy of a generated paper (no verifier content). */
  downloadGeneratedPaper: async (id: number, format: "pdf" | "md", annotations = false) => {
    const response = await api.get<Blob>(`/reports/${id}/paper.${format}`, { responseType: "blob", params: annotations ? { annotations: "true" } : undefined });
    const disposition = String(response.headers["content-disposition"] ?? "");
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return { blob: response.data, filename: match?.[1] ?? `generated-paper-${id}.${format}` };
  },
  adoptGeneratedPaper: (id: number, payload: { year: number; semester: string; includeAnnotations?: boolean }) =>
    api.post<{ data: QuestionPaper & { duplicateWarnings: UploadDuplicateWarning[]; sourceReportId: number } }>(`/reports/${id}/adopt-paper`, payload).then((r) => r.data.data),
};
