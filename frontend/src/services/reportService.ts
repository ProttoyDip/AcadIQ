import { api } from "./api";
import { AnalysisReport } from "../types";

export const reportService = {
  list: () => api.get<{ data: AnalysisReport[] }>("/reports").then((r) => r.data.data),
  getById: (id: number) => api.get<{ data: AnalysisReport }>(`/reports/${id}`).then((r) => r.data.data),
};
