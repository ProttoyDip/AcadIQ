import { api } from "./api";
import { CopilotChatResponse, CopilotSessionDetail, CopilotSessionSummary } from "../types";

export interface CopilotChatPayload {
  sessionId?: number;
  courseId: number;
  examId?: number;
  reportId?: number;
  message: string;
}

export const copilotService = {
  chat: (payload: CopilotChatPayload) =>
    api.post<{ data: CopilotChatResponse }>("/copilot/chat", payload).then((r) => r.data.data),

  listSessions: (courseId?: number) =>
    api
      .get<{ data: CopilotSessionSummary[] }>("/copilot/sessions", { params: courseId ? { courseId } : undefined })
      .then((r) => r.data.data),

  getSession: (id: number) =>
    api.get<{ data: CopilotSessionDetail }>(`/copilot/sessions/${id}`).then((r) => r.data.data),
};
