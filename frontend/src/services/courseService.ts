import { api } from "./api";

export interface CreateCoursePayload {
  courseCode: string;
  courseName: string;
  description?: string;
}

export const courseService = {
  list: () => api.get("/courses").then((r) => r.data.data),
  getById: (id: number) => api.get(`/courses/${id}`).then((r) => r.data.data),
  create: (payload: CreateCoursePayload) => api.post("/courses", payload).then((r) => r.data.data),
};
