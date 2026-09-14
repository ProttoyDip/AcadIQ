import { api } from "./api";
import { SyllabusDocument, QuestionPaper, TeachingMaterial } from "../types";

export const uploadService = {
  uploadTeachingMaterials: (courseId: number, files: File[], options: { title?: string; kind?: TeachingMaterial["kind"] } = {}) => {
    const form = new FormData();
    form.append("courseId", String(courseId));
    if (options.title) form.append("title", options.title);
    if (options.kind) form.append("kind", options.kind);
    for (const file of files) form.append("files", file);
    return api
      .post<{ data: { materials: TeachingMaterial[]; failures: Array<{ file: string; error: string }> } }>("/upload/material", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.data);
  },

  listTeachingMaterials: (courseId: number) =>
    api.get<{ data: TeachingMaterial[] }>(`/courses/${courseId}/materials`).then((r) => r.data.data),

  deleteTeachingMaterial: (courseId: number, materialId: number) =>
    api.delete<{ data: { id: number } }>(`/courses/${courseId}/materials/${materialId}`).then((r) => r.data.data),

  uploadSyllabus: (courseId: number, file: File) => {
    const form = new FormData();
    form.append("courseId", String(courseId));
    form.append("file", file);
    return api
      .post<{ data: SyllabusDocument }>("/upload/syllabus", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.data);
  },

  uploadQuestionPaper: (courseId: number, year: number, semester: string, file: File) => {
    const form = new FormData();
    form.append("courseId", String(courseId));
    form.append("year", String(year));
    form.append("semester", semester);
    form.append("file", file);
    return api
      .post<{ data: QuestionPaper }>("/upload/question-paper", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.data);
  },
};
