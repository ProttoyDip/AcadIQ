import { api } from "./api";

export interface AiStatus {
  running: boolean;
  baseUrl: string;
  models: string[];
  config: {
    textModel: string;
    visionModel: string;
    embeddingModel: string;
  };
  missingModels: string[];
}

export interface AiDocument {
  id: number;
  title: string;
  originalName: string;
  fileSize: number;
  fileType: string;
  status: string;
  summary?: string | null;
  keyPoints?: string[] | null;
  chunkCount: number;
  questionCount: number;
  createdAt: string;
  metadata?: {
    pageCount?: number;
    detectedTopics?: string[];
  };
}

export interface PdfUploadResult {
  documentId: number;
  title: string;
  originalName: string;
  fileSize: number;
  pageCount: number;
  chunkCount: number;
  status: string;
  createdAt: string;
}

export interface PdfSummaryResult {
  documentId: number;
  summaryType: "short" | "detailed" | "key_points" | "important_concepts" | "topic_summary";
  summary: string;
  keyPoints: string[];
}

export interface RagSource {
  chunkIndex: number;
  pageNumber: number | null;
  section: string | null;
  similarity: number;
  snippet: string;
}

export interface PdfQAResult {
  documentId: number;
  documentTitle: string;
  answer: string;
  grounded: boolean;
  sources: RagSource[];
  model: string;
}

export interface ImageAnalysisResult {
  answer: string;
  question: string;
  model: string;
}

export interface GeneratedQuestionItem {
  question: string;
  type: string;
  difficulty: string;
  topic?: string | null;
  options?: string[] | null;
  correctAnswer?: string | null;
  explanation?: string | null;
}

export interface QuestionGenerationResult {
  questions: GeneratedQuestionItem[];
  total: number;
  documentId?: number;
}

export interface GenerateQuestionsPayload {
  file?: File;
  courseText?: string;
  documentId?: number;
  questionCount?: number;
  questionType?: string;
  difficulty?: string;
  topic?: string;
  includeAnswers?: boolean;
  includeExplanations?: boolean;
}

export interface SavedGeneratedQuestion {
  id: number;
  documentId?: number | null;
  userId?: number | null;
  topic?: string | null;
  difficulty: string;
  type: string;
  question: string;
  options?: string[] | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  createdAt: string;
  document?: {
    id: number;
    title: string;
    originalName: string;
  } | null;
}

export interface AiHistoryOverview {
  totalDocuments: number;
  totalQuestions: number;
  readySummariesCount: number;
  documentsWithSummary: Array<{
    id: number;
    title: string;
    originalName: string;
    summary: string;
    keyPoints: string[] | null;
    createdAt: string;
  }>;
  recentQuestions: SavedGeneratedQuestion[];
}

export const aiService = {
  getStatus: () =>
    api.get<{ success: boolean; data: AiStatus }>("/ai/status").then((r) => r.data.data),

  listDocuments: () =>
    api.get<{ success: boolean; data: AiDocument[] }>("/ai/documents").then((r) => r.data.data),

  getDocument: (id: number) =>
    api.get<{ success: boolean; data: AiDocument }>(`/ai/document/${id}`).then((r) => r.data.data),

  deleteDocument: (id: number) =>
    api.delete<{ success: boolean; data: { deleted: boolean; documentId: number } }>(`/ai/document/${id}`).then((r) => r.data.data),

  uploadPdf: (file: File, title?: string, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);

    return api
      .post<{ success: boolean; data: PdfUploadResult }>("/ai/pdf/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(pct);
          }
        },
      })
      .then((r) => r.data.data);
  },

  summarizePdf: (documentId: number, type = "detailed") =>
    api
      .post<{ success: boolean; data: PdfSummaryResult }>("/ai/pdf/summarize", { documentId, type })
      .then((r) => r.data.data),

  askPdf: (documentId: number, question: string) =>
    api
      .post<{ success: boolean; data: PdfQAResult }>("/ai/pdf/ask", { documentId, question })
      .then((r) => r.data.data),

  analyzeImage: (file?: File, question?: string, base64?: string) => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      if (question) formData.append("question", question);

      return api
        .post<{ success: boolean; data: ImageAnalysisResult }>("/ai/image/analyze", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data);
    }

    return api
      .post<{ success: boolean; data: ImageAnalysisResult }>("/ai/image/analyze", {
        base64,
        question,
      })
      .then((r) => r.data.data);
  },

  generateQuestions: (payload: GenerateQuestionsPayload) => {
    if (payload.file) {
      const formData = new FormData();
      formData.append("file", payload.file);
      if (payload.questionCount) formData.append("questionCount", String(payload.questionCount));
      if (payload.questionType) formData.append("questionType", payload.questionType);
      if (payload.difficulty) formData.append("difficulty", payload.difficulty);
      if (payload.topic) formData.append("topic", payload.topic);
      formData.append("includeAnswers", String(payload.includeAnswers ?? true));
      formData.append("includeExplanations", String(payload.includeExplanations ?? true));

      return api
        .post<{ success: boolean; data: QuestionGenerationResult }>("/ai/course/generate-questions", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data);
    }

    return api
      .post<{ success: boolean; data: QuestionGenerationResult }>("/ai/course/generate-questions", payload)
      .then((r) => r.data.data);
  },

  listQuestionHistory: (params?: { documentId?: number; type?: string; difficulty?: string; search?: string; limit?: number }) =>
    api.get<{ success: boolean; data: SavedGeneratedQuestion[] }>("/ai/questions/history", { params }).then((r) => r.data.data),

  deleteQuestion: (id: number) =>
    api.delete<{ success: boolean; data: { deleted: boolean; questionId: number } }>(`/ai/questions/${id}`).then((r) => r.data.data),

  getHistoryOverview: () =>
    api.get<{ success: boolean; data: AiHistoryOverview }>("/ai/history").then((r) => r.data.data),
};
