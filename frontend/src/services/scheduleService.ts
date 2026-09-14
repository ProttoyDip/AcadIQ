import { api } from "./api";
import {
  CalendarEvent,
  ClassNotice,
  ClassSession,
  ClassSlot,
  FreeSlotCandidate,
  MakeupDebt,
  PaceReport,
  ReplanResult,
  RoutineExtractResult,
  SlotDraft,
  Term,
  TodayBriefing,
} from "../types";

const unwrap = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const scheduleService = {
  listTerms: () => unwrap(api.get<{ data: Term[] }>("/schedule/terms")),
  createTerm: (payload: { name: string; startDate: string; endDate: string }) => unwrap(api.post<{ data: Term }>("/schedule/terms", payload)),
  updateTerm: (termId: number, payload: Partial<{ name: string; startDate: string; endDate: string; isActive: boolean }>) =>
    unwrap(api.patch<{ data: Term }>(`/schedule/terms/${termId}`, payload)),
  deleteTerm: (termId: number) => unwrap(api.delete<{ data: { id: number } }>(`/schedule/terms/${termId}`)),

  listSlots: (termId: number) => unwrap(api.get<{ data: ClassSlot[] }>(`/schedule/terms/${termId}/slots`)),
  saveSlots: (termId: number, slots: SlotDraft[], replace = false) =>
    unwrap(api.post<{ data: { slots: ClassSlot[]; sessions: number } }>(`/schedule/terms/${termId}/slots`, { slots, replace })),
  deleteSlot: (termId: number, slotId: number) => unwrap(api.delete<{ data: { id: number } }>(`/schedule/terms/${termId}/slots/${slotId}`)),

  extractRoutine: (file: File, options: { facultyName?: string; initials?: string } = {}) => {
    const form = new FormData();
    form.append("file", file);
    if (options.facultyName) form.append("facultyName", options.facultyName);
    if (options.initials) form.append("initials", options.initials);
    return unwrap(api.post<{ data: RoutineExtractResult }>("/schedule/routine/extract", form, { headers: { "Content-Type": "multipart/form-data" } }));
  },

  listEvents: (termId: number) => unwrap(api.get<{ data: CalendarEvent[] }>(`/schedule/terms/${termId}/events`)),
  addEvents: (termId: number, events: Array<{ date: string; endDate?: string | null; kind: CalendarEvent["kind"]; title: string }>) =>
    unwrap(api.post<{ data: { events: CalendarEvent[]; sessions: number } }>(`/schedule/terms/${termId}/events`, { events })),
  deleteEvent: (termId: number, eventId: number) => unwrap(api.delete<{ data: { id: number } }>(`/schedule/terms/${termId}/events/${eventId}`)),

  listSessions: (termId: number, params: { from?: string; to?: string; courseId?: number } = {}) =>
    unwrap(api.get<{ data: ClassSession[] }>(`/schedule/terms/${termId}/sessions`, { params })),
  createSession: (termId: number, payload: Partial<SlotDraft> & { courseLabel: string; date: string; startTime: string; endTime: string; plannedTopics?: string[] }) =>
    unwrap(api.post<{ data: ClassSession }>(`/schedule/terms/${termId}/sessions`, payload)),
  updateSession: (sessionId: number, payload: Partial<Pick<ClassSession, "date" | "startTime" | "endTime" | "room" | "plannedTopics">> & { status?: "SCHEDULED" | "HELD" }) =>
    unwrap(api.patch<{ data: ClassSession }>(`/schedule/sessions/${sessionId}`, payload)),
  deleteSession: (sessionId: number) => unwrap(api.delete<{ data: { id: number } }>(`/schedule/sessions/${sessionId}`)),
  cancelSession: (sessionId: number, reason?: string) => unwrap(api.post<{ data: ClassSession }>(`/schedule/sessions/${sessionId}/cancel`, { reason })),
  restoreSession: (sessionId: number) => unwrap(api.post<{ data: ClassSession }>(`/schedule/sessions/${sessionId}/restore`)),
  suggestions: (sessionId: number) =>
    unwrap(api.get<{ data: { sessionId: number; window: { from: string; to: string }; suggestions: FreeSlotCandidate[] } }>(`/schedule/sessions/${sessionId}/suggestions`)),
  reschedule: (sessionId: number, payload: { date: string; startTime: string; endTime: string; room?: string | null; reason?: string }) =>
    unwrap(api.post<{ data: { original: ClassSession; makeup: ClassSession } }>(`/schedule/sessions/${sessionId}/reschedule`, payload)),
  logSession: (sessionId: number, payload: { coveredTopics: string[]; notes?: string; materialIds?: number[] }) =>
    unwrap(api.post<{ data: ClassSession }>(`/schedule/sessions/${sessionId}/log`, payload)),
  notice: (sessionId: number, channel: "EMAIL" | "CHAT") => unwrap(api.post<{ data: ClassNotice }>(`/schedule/sessions/${sessionId}/notice`, { channel })),

  makeupDebt: (termId: number) => unwrap(api.get<{ data: MakeupDebt }>(`/schedule/terms/${termId}/makeup-debt`)),
  today: (date?: string) => unwrap(api.get<{ data: TodayBriefing }>("/schedule/today", { params: date ? { date } : {} })),
  pace: (courseId: number) => unwrap(api.get<{ data: PaceReport }>(`/schedule/pace/${courseId}`)),
  replan: (courseId: number, note?: string, apply = false) => unwrap(api.post<{ data: ReplanResult }>("/schedule/replan", { courseId, note, apply })),
  ics: (termId: number) => api.get<string>(`/schedule/terms/${termId}/calendar.ics`, { responseType: "text" }).then((r) => r.data),
};
