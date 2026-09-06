import { api } from "./api";

export const uploadService = {
  uploadSyllabus: (courseId: number, file: File) => {
    const form = new FormData();
    form.append("courseId", String(courseId));
    form.append("file", file);
    return api.post("/upload/syllabus", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
  },

  uploadQuestionPaper: (courseId: number, year: number, semester: string, file: File) => {
    const form = new FormData();
    form.append("courseId", String(courseId));
    form.append("year", String(year));
    form.append("semester", semester);
    form.append("file", file);
    return api.post("/upload/question-paper", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
  },
};
