import { api } from "./api";

export const reportService = {
  list: () => api.get("/reports").then((r) => r.data.data),
  getById: (id: number) => api.get(`/reports/${id}`).then((r) => r.data.data),
};
