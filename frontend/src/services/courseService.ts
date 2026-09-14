import { api } from "./api";
import { Course, NeighbourHit } from "../types";

export interface CreateCoursePayload {
  courseCode: string;
  courseName: string;
  description?: string;
}

export const courseService = {
  list: () => api.get<{ data: Course[] }>("/courses").then((r) => r.data.data),
  getById: (id: number) => api.get<{ data: Course }>(`/courses/${id}`).then((r) => r.data.data),
  create: (payload: CreateCoursePayload) => api.post<{ data: Course }>("/courses", payload).then((r) => r.data.data),
  searchQuestions: (courseId: number, q: string, k = 10) =>
    api.get<{ data: { hits: NeighbourHit[]; model: string } }>(`/courses/${courseId}/questions/search`, { params: { q, k } }).then((r) => r.data.data),
};
