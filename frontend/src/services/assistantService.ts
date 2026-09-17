import { api } from "./api";
import { AssistantChatReply, AssistantExecuteResult } from "../types";

export interface AssistantPageContext {
  path?: string;
  courseId?: number;
  paperId?: number;
  reportId?: number;
}

export const assistantService = {
  chat: (payload: { message: string; history: Array<{ role: "user" | "assistant"; content: string }>; page?: AssistantPageContext; clientDate?: string }) =>
    api.post<{ data: AssistantChatReply }>("/assistant/chat", payload).then((r) => r.data.data),
  execute: (payload: { actionToken: string; actions: Array<{ tool: string; args: Record<string, unknown> }>; skip?: number[] }) =>
    api.post<{ data: AssistantExecuteResult }>("/assistant/execute", payload).then((r) => r.data.data),
  attach: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ data: { id: string; name: string; mimetype: string; size: number } }>("/assistant/attachments", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data.data);
  },
  discardAttachment: (id: string) => api.delete(`/assistant/attachments/${id}`).then(() => undefined),
};
