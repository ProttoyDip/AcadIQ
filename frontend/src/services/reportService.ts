import { api } from "./api";
import { AnalysisReport } from "../types";

export const reportService = {
  list: () => api.get<{ data: AnalysisReport[] }>("/reports").then((r) => r.data.data),
  getById: (id: number) => api.get<{ data: AnalysisReport }>(`/reports/${id}`).then((r) => r.data.data),
  downloadPdf: async (id: number) => {
    const response = await api.get<Blob>(`/reports/${id}/pdf`, { responseType: "blob" });
    const disposition = String(response.headers["content-disposition"] ?? "");
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return { blob: response.data, filename: match?.[1] ?? `acadiq-report-${id}.pdf` };
  },
};
