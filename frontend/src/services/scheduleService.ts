import { api } from "./api";
import {
  CalendarEvent,
  Clash,
  ClassNotice,
  ClassSession,
  ClassSlot,
  DepartmentRoutine,
  DepartmentSlot,
  DigestPrefs,
  DigestPreview,
  FreeRoomsResult,
  FreeSlotCandidate,
  MakeupDebt,
  PaceReport,
  ReplanResult,
  RoutineExtractResult,
  SlotDraft,
  Term,
  TodayBriefing,
  WorkloadReport,
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

  extractRoutine: (file: File, options: { facultyName?: string; initials?: string; allRowsAreMine?: boolean } = {}) => {
    const form = new FormData();
    form.append("file", file);
    if (options.facultyName) form.append("facultyName", options.facultyName);
    if (options.initials) form.append("initials", options.initials);
    if (options.allRowsAreMine) form.append("allRowsAreMine", "true");
    return unwrap(api.post<{ data: RoutineExtractResult }>("/schedule/routine/extract", form, { headers: { "Content-Type": "multipart/form-data" } }));
  },

  listEvents: (termId: number) => unwrap(api.get<{ data: CalendarEvent[] }>(`/schedule/terms/${termId}/events`)),
  addEvents: (termId: number, events: Array<{ date: string; endDate?: string | null; kind: CalendarEvent["kind"]; title: string; courseId?: number | null; section?: string | null; startTime?: string | null; endTime?: string | null }>) =>
    unwrap(api.post<{ data: { events: CalendarEvent[]; sessions: number; clashes: Clash[] } }>(`/schedule/terms/${termId}/events`, { events })),
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

  // Phase 4
  feedUrl: (termId: number, rotate = false) => unwrap(api.get<{ data: { termId: number; url: string; rotated: boolean } }>(`/schedule/terms/${termId}/feed-url`, { params: rotate ? { rotate: "true" } : {} })),
  revokeFeed: (termId: number) => unwrap(api.delete<{ data: { revoked: boolean } }>(`/schedule/terms/${termId}/feed-url`)),
  clashes: (termId: number) => unwrap(api.get<{ data: Clash[] }>(`/schedule/terms/${termId}/clashes`)),
  workload: (termId: number) => unwrap(api.get<{ data: WorkloadReport }>(`/schedule/terms/${termId}/workload`)),
  digestPrefs: () => unwrap(api.get<{ data: DigestPrefs }>("/schedule/digest/prefs")),
  updateDigestPrefs: (payload: { digestEnabled?: boolean; digestHour?: number; timezone?: string | null }) => unwrap(api.patch<{ data: DigestPrefs }>("/schedule/digest/prefs", payload)),
  digestPreview: () => unwrap(api.get<{ data: DigestPreview }>("/schedule/digest/preview")),
  digestSendNow: () => unwrap(api.post<{ data: { sent: boolean; to: string; subject: string } }>("/schedule/digest/send-now")),
  freeRooms: (params: { date: string; startTime: string; endTime: string }) => unwrap(api.get<{ data: FreeRoomsResult }>("/schedule/rooms/free", { params })),
  roomsAvailable: () => unwrap(api.get<{ data: { available: boolean } }>("/schedule/rooms/available")),

  // Admin: department routine
  listDepartmentRoutines: () => unwrap(api.get<{ data: DepartmentRoutine[] }>("/admin/department-routine")),
  departmentSlots: (routineId: number) => unwrap(api.get<{ data: DepartmentSlot[] }>(`/admin/department-routine/${routineId}/slots`)),
  importDepartmentRoutine: (file: File, termLabel: string, replace = true) => {
    const form = new FormData();
    form.append("file", file);
    form.append("termLabel", termLabel);
    form.append("replace", String(replace));
    return unwrap(api.post<{ data: DepartmentRoutine & { warnings: string[]; rooms: number; teachers: number } }>("/admin/department-routine", form, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  deleteDepartmentRoutine: (routineId: number) => unwrap(api.delete<{ data: { id: number } }>(`/admin/department-routine/${routineId}`)),
};
