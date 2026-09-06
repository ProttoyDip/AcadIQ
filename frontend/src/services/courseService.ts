import { api } from "./api";
import { Course } from "../types";

export interface CreateCoursePayload {
  courseCode: string;
  courseName: string;
  description?: string;
}

export const courseService = {
  list: () => api.get<{ data: Course[] }>("/courses").then((r) => r.data.data),
  getById: (id: number) => api.get<{ data: Course }>(`/courses/${id}`).then((r) => r.data.data),
  create: (payload: CreateCoursePayload) => api.post<{ data: Course }>("/courses", payload).then((r) => r.data.data),
};
