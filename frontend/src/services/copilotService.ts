import { api } from "./api";
import { CopilotChatResponse, CopilotSessionDetail, CopilotSessionSummary } from "../types";

export interface CopilotChatPayload {
  sessionId?: number;
  courseId: number;
  examId?: number;
  reportId?: number;
  message: string;
}

export type CopilotVoicePayload = Omit<CopilotChatPayload, "message"> & { language?: string };

export const copilotService = {
  chat: (payload: CopilotChatPayload) =>
    api.post<{ data: CopilotChatResponse }>("/copilot/chat", payload).then((r) => r.data.data),

  /** Recorded clip → transcript + the same grounded answer `chat` returns. */
  voice: (payload: CopilotVoicePayload, clip: Blob) => {
    const form = new FormData();
    // The extension matters to the provider's format sniffing; the browser's
    // MIME type is authoritative about what MediaRecorder actually produced.
    const ext = clip.type.includes("mp4") ? "mp4" : clip.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", clip, `voice.${ext}`);
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, String(value));
    });
    return api
      .post<{ data: CopilotChatResponse & { transcript: string } }>("/copilot/voice", form)
      .then((r) => r.data.data);
  },

  /** Dictation: audio in, text out. No Copilot turn, no course context needed. */
  transcribe: (clip: Blob, language?: string) => {
    const form = new FormData();
    const ext = clip.type.includes("mp4") ? "mp4" : clip.type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", clip, `voice.${ext}`);
    if (language) form.append("language", language);
    return api.post<{ data: { transcript: string } }>("/copilot/transcribe", form).then((r) => r.data.data);
  },

  listSessions: (courseId?: number) =>
    api
      .get<{ data: CopilotSessionSummary[] }>("/copilot/sessions", { params: courseId ? { courseId } : undefined })
      .then((r) => r.data.data),

  getSession: (id: number) =>
    api.get<{ data: CopilotSessionDetail }>(`/copilot/sessions/${id}`).then((r) => r.data.data),
};
