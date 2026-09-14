import { api } from "./api";
import {
  BankQuestion,
  BlueprintComparison,
  ExamBlueprint,
  LecturePlanRecord,
  MarksAnalysisResult,
  MarksSummary,
  MarksUploadResult,
  MaterialGapResult,
  QuestionRewriteResult,
  RubricRecord,
} from "../types";

const unwrap = <T>(promise: Promise<{ data: { data: T } }>) => promise.then((r) => r.data.data);

export const workflowService = {
  // Marks & item analysis
  uploadMarksCsv: (paperId: number, csv: string) => unwrap(api.post<{ data: MarksUploadResult }>(`/papers/${paperId}/marks`, { csv })),
  marksSummary: (paperId: number) => unwrap(api.get<{ data: MarksSummary }>(`/papers/${paperId}/marks`)),
  marksAnalysis: (paperId: number, params: { passMark?: number; threshold?: number } = {}) =>
    unwrap(api.get<{ data: MarksAnalysisResult }>(`/papers/${paperId}/marks/analysis`, { params })),
  deleteMarks: (paperId: number) => unwrap(api.delete<{ data: { deleted: number } }>(`/papers/${paperId}/marks`)),

  // Marking schemes
  generateRubric: (courseId: number, questionPaperId: number) =>
    unwrap(api.post<{ data: RubricRecord }>("/analysis/rubric", { courseId, questionPaperId })),
  listRubrics: (courseId: number) => unwrap(api.get<{ data: RubricRecord[] }>(`/courses/${courseId}/rubrics`)),
  rubricMarkdownUrl: (rubricId: number) => `${api.defaults.baseURL}/rubrics/${rubricId}.md`,
  rubricMarkdown: (rubricId: number) => api.get<string>(`/rubrics/${rubricId}.md`, { responseType: "text" }).then((r) => r.data),
  deleteRubric: (rubricId: number) => unwrap(api.delete<{ data: { id: number } }>(`/rubrics/${rubricId}`)),

  // Question rewriter
  rewriteQuestion: (payload: { questionId?: number; text?: string; marks?: number; mode: string; targetBloom?: string; instruction?: string }) =>
    unwrap(api.post<{ data: QuestionRewriteResult }>("/analysis/rewrite-question", payload)),

  // Blueprint
  getBlueprint: (courseId: number) => unwrap(api.get<{ data: ExamBlueprint }>(`/courses/${courseId}/blueprint`)),
  saveBlueprint: (courseId: number, payload: Partial<ExamBlueprint>) => unwrap(api.put<{ data: ExamBlueprint }>(`/courses/${courseId}/blueprint`, payload)),
  compareBlueprint: (courseId: number, paperId: number) =>
    unwrap(api.get<{ data: BlueprintComparison }>(`/courses/${courseId}/blueprint/compare/${paperId}`)),

  // Question bank
  questionBank: (courseId: number, params: { q?: string; bloom?: string; topic?: string; paperId?: number } = {}) =>
    unwrap(api.get<{ data: { questions: BankQuestion[]; topics: string[]; bloomLevels: string[] } }>(`/courses/${courseId}/questions`, { params })),

  // Lecture plan
  listLecturePlans: (courseId: number) => unwrap(api.get<{ data: LecturePlanRecord[] }>(`/courses/${courseId}/lecture-plans`)),
  generateLecturePlan: (courseId: number, payload: { weeks: number; hoursPerWeek: number; startNote?: string }) =>
    unwrap(api.post<{ data: LecturePlanRecord }>(`/courses/${courseId}/lecture-plans`, payload)),
  deleteLecturePlan: (courseId: number, planId: number) => unwrap(api.delete<{ data: { id: number } }>(`/courses/${courseId}/lecture-plans/${planId}`)),

  // Material gap check
  materialGaps: (courseId: number) => unwrap(api.get<{ data: MaterialGapResult }>(`/courses/${courseId}/material-gaps`)),

  // Course file export
  courseFileUrl: (courseId: number) => `${api.defaults.baseURL}/courses/${courseId}/course-file.zip`,
  downloadCourseFile: (courseId: number) => api.get<Blob>(`/courses/${courseId}/course-file.zip`, { responseType: "blob" }).then((r) => r.data),
};
