import { dayOfWeek, eachDate, overlaps, weekIndex } from "./dates";

export interface SlotTemplate {
  id: number;
  courseId: number | null;
  courseLabel: string;
  section: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: string;
}

export interface BlockedDay {
  date: string;
  endDate: string | null;
  kind: string;
  title: string;
}

export interface GeneratedSession {
  slotId: number;
  courseId: number | null;
  courseLabel: string;
  section: string | null;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: string;
  status: "SCHEDULED" | "HOLIDAY";
  reason: string | null;
  plannedWeek: number;
}

/**
 * `bounds` clamps each event to the window the caller actually cares about
 * (the term, or the search window). It is what keeps an over-long event row
 * that predates the span caps from expanding into millions of Map entries on
 * every read — the event still blocks the days it genuinely covers, so the
 * clamp is invisible to correct data.
 */
export function blockedDates(events: BlockedDay[], bounds?: { start: string; end: string }): Map<string, string> {
  const map = new Map<string, string>();
  for (const event of events) {
    if (event.kind !== "HOLIDAY" && event.kind !== "EXAM_WEEK") continue;
    let from = event.date;
    let to = event.endDate ?? event.date;
    if (bounds) {
      if (from < bounds.start) from = bounds.start;
      if (to > bounds.end) to = bounds.end;
    }
    if (from > to) continue;
    for (const date of eachDate(from, to)) map.set(date, event.title);
  }
  return map;
}

/**
 * Expands weekly slots over the term. Holidays/exam weeks produce HOLIDAY rows
 * (kept, so the make-up debt and the calendar both show what was lost).
 */
export function generateSessions(term: { startDate: string; endDate: string }, slots: SlotTemplate[], events: BlockedDay[]): GeneratedSession[] {
  const blocked = blockedDates(events, { start: term.startDate, end: term.endDate });
  const bySlotDay = new Map<number, SlotTemplate[]>();
  for (const slot of slots) bySlotDay.set(slot.dayOfWeek, [...(bySlotDay.get(slot.dayOfWeek) ?? []), slot]);
  const out: GeneratedSession[] = [];
  for (const date of eachDate(term.startDate, term.endDate)) {
    const daySlots = bySlotDay.get(dayOfWeek(date));
    if (!daySlots) continue;
    const holiday = blocked.get(date);
    for (const slot of daySlots) {
      out.push({
        slotId: slot.id,
        courseId: slot.courseId,
        courseLabel: slot.courseLabel,
        section: slot.section,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        kind: slot.kind,
        status: holiday ? "HOLIDAY" : "SCHEDULED",
        reason: holiday ?? null,
        plannedWeek: weekIndex(term.startDate, date),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export interface ExistingSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  section: string | null;
  courseLabel: string;
  room: string | null;
}

export interface FreeSlotCandidate {
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  score: number;
  reasons: string[];
}

/** Optional department-level knowledge (rooms/sections of other teachers). */
export interface AvailabilityHooks {
  roomBusy?: (date: string, startTime: string, endTime: string, room: string | null) => boolean;
  sectionBusy?: (date: string, startTime: string, endTime: string, section: string | null, courseLabel: string) => boolean;
  freeRoomAt?: (date: string, startTime: string, endTime: string) => string | null;
}

/**
 * Deterministic make-up finder. Candidates are the faculty's own weekday grid
 * (08:00–18:00, aligned to the cancelled session's length); each is rejected if it
 * clashes with the faculty's other sessions or gives the same section two classes
 * of that course the same day, and scored for closeness to the original weekday/time.
 */
export function findFreeSlots(
  cancelled: { date: string; startTime: string; endTime: string; section: string | null; courseLabel: string; room: string | null },
  existing: ExistingSession[],
  events: BlockedDay[],
  options: { from: string; to: string; limit?: number; dayStart?: string; dayEnd?: string; stepMinutes?: number; excludeDays?: number[]; hooks?: AvailabilityHooks } 
): FreeSlotCandidate[] {
  const hooks = options.hooks ?? {};
  const limit = options.limit ?? 6;
  const step = options.stepMinutes ?? 30;
  const dayStart = options.dayStart ?? "08:00";
  const dayEnd = options.dayEnd ?? "18:00";
  const excludeDays = new Set(options.excludeDays ?? [5]); // Friday off by default (BD academic week)
  const blocked = blockedDates(events, { start: options.from, end: options.to });
  const duration = toMin(cancelled.endTime) - toMin(cancelled.startTime);
  const originalDow = dayOfWeek(cancelled.date);
  const active = existing.filter((s) => s.status === "SCHEDULED" || s.status === "MAKEUP" || s.status === "HELD");
  const byDate = new Map<string, ExistingSession[]>();
  for (const s of active) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const candidates: FreeSlotCandidate[] = [];
  for (const date of eachDate(options.from, options.to)) {
    if (date <= cancelled.date && date !== cancelled.date) continue;
    if (blocked.has(date) || excludeDays.has(dayOfWeek(date))) continue;
    const dayItems = byDate.get(date) ?? [];
    const sameCourseSameSection = dayItems.some((s) => s.courseLabel === cancelled.courseLabel && (s.section ?? "") === (cancelled.section ?? ""));
    for (let start = toMin(dayStart); start + duration <= toMin(dayEnd); start += step) {
      const startTime = fromMin(start);
      const endTime = fromMin(start + duration);
      // The cancelled window itself is "free" now — never offer it back.
      if (date === cancelled.date && overlaps(startTime, endTime, cancelled.startTime, cancelled.endTime)) continue;
      if (dayItems.some((s) => overlaps(startTime, endTime, s.startTime, s.endTime))) continue;
      const reasons: string[] = [];
      let score = 100;
      const daysAway = (Date.parse(date) - Date.parse(cancelled.date)) / 86_400_000;
      score -= Math.min(40, daysAway * 3);
      if (daysAway === 0) {
        // Same-day shifts are usually blocked by whatever caused the cancellation.
        score -= 12;
        reasons.push("same day as the cancelled class");
      } else if (daysAway <= 7) reasons.push("within a week of the cancelled class");
      if (dayOfWeek(date) === originalDow) {
        score += 15;
        reasons.push("same weekday as the original slot");
      }
      if (startTime === cancelled.startTime) {
        score += 15;
        reasons.push("same time as the original slot");
      } else if (Math.abs(start - toMin(cancelled.startTime)) <= 60) {
        score += 5;
      }
      if (sameCourseSameSection) {
        score -= 25;
        reasons.push("section already has this course that day");
      }
      // Adjacent to an existing class = students/faculty already on campus.
      if (dayItems.some((s) => s.endTime === startTime || s.startTime === endTime)) {
        score += 8;
        reasons.push("back-to-back with an existing class");
      }
      if (dayItems.length === 0) reasons.push("otherwise free day");
      // Department routine, when available: the section must be free; keep the room if free, else propose another.
      if (hooks.sectionBusy?.(date, startTime, endTime, cancelled.section, cancelled.courseLabel)) continue;
      let room = cancelled.room;
      if (room && hooks.roomBusy?.(date, startTime, endTime, room)) {
        const alternative = hooks.freeRoomAt?.(date, startTime, endTime) ?? null;
        if (!alternative) continue;
        room = alternative;
        score -= 5;
        reasons.push(`${cancelled.room} is taken; ${alternative} is free`);
      } else if (room && hooks.roomBusy) {
        reasons.push(`${room} is free`);
      }
      candidates.push({ date, startTime, endTime, room, score: Math.round(score), reasons });
    }
  }
  // Best score per date first, then diversify across dates so the list isn't 6 half-hours of one day.
  candidates.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const seenDates = new Map<string, number>();
  const picked: FreeSlotCandidate[] = [];
  for (const c of candidates) {
    const n = seenDates.get(c.date) ?? 0;
    if (n >= 2) continue;
    seenDates.set(c.date, n + 1);
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
