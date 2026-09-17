import { addDays, dayOfWeek, overlaps } from "./dates";

export interface ClashEvent {
  id: number;
  kind: string;
  title: string;
  date: string;
  endDate: string | null;
  courseId: number | null;
  courseLabel?: string | null;
  section: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface ClashSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  courseId: number | null;
  courseLabel: string;
  section: string | null;
  plannedTopics: string[] | null;
  coveredTopics: string[] | null;
}

export interface Clash {
  severity: "HIGH" | "MEDIUM" | "LOW";
  rule: "SAME_DAY" | "OVERLOADED_WEEK" | "OVERLAPS_CLASS" | "ON_BLOCKED_DAY" | "UNTAUGHT_TOPICS";
  message: string;
  hint: string;
  eventIds: number[];
  sessionId?: number;
}

const sectionKey = (e: { courseLabel?: string | null; section: string | null }) => (e.section ?? "").trim().toLowerCase() || "*";
const weekStart = (iso: string) => addDays(iso, -dayOfWeek(iso));

/**
 * Deterministic assessment sanity checks for one faculty's calendar. The rules are
 * deliberately conservative: a HIGH clash is something students would complain about.
 */
export function detectClashes(events: ClashEvent[], sessions: ClashSession[]): Clash[] {
  const clashes: Clash[] = [];
  const assessments = events.filter((e) => e.kind === "ASSESSMENT");
  const blocked = new Map<string, string>();
  for (const e of events) {
    if (e.kind !== "HOLIDAY" && e.kind !== "EXAM_WEEK") continue;
    for (let d = e.date; d <= (e.endDate ?? e.date); d = addDays(d, 1)) blocked.set(d, e.title);
  }

  // Rule 1: two assessments for the same section (or unscoped) on the same date.
  const byDaySection = new Map<string, ClashEvent[]>();
  for (const a of assessments) {
    const key = `${a.date}|${sectionKey(a)}`;
    byDaySection.set(key, [...(byDaySection.get(key) ?? []), a]);
  }
  for (const group of byDaySection.values()) {
    if (group.length < 2) continue;
    clashes.push({
      severity: "HIGH",
      rule: "SAME_DAY",
      message: `${group.map((g) => g.title).join(" and ")} both fall on ${group[0].date}${group[0].section ? ` for section ${group[0].section}` : ""}.`,
      hint: "Move one assessment to another day so students are not tested twice in one day.",
      eventIds: group.map((g) => g.id),
    });
  }

  // Rule 2: three or more assessments for one section within a Sunday-start week.
  const byWeekSection = new Map<string, ClashEvent[]>();
  for (const a of assessments) {
    const key = `${weekStart(a.date)}|${sectionKey(a)}`;
    byWeekSection.set(key, [...(byWeekSection.get(key) ?? []), a]);
  }
  for (const [key, group] of byWeekSection) {
    if (group.length < 3) continue;
    const [start] = key.split("|");
    clashes.push({
      severity: "MEDIUM",
      rule: "OVERLOADED_WEEK",
      message: `${group.length} assessments in the week of ${start}${group[0].section ? ` for section ${group[0].section}` : ""}: ${group.map((g) => g.title).join(", ")}.`,
      hint: "Spread assessments across weeks; two per week is a common departmental ceiling.",
      eventIds: group.map((g) => g.id),
    });
  }

  // Rule 3: timed assessment overlaps one of the faculty's own classes for a different course.
  const active = sessions.filter((s) => ["SCHEDULED", "MAKEUP", "HELD"].includes(s.status));
  for (const a of assessments) {
    if (!a.startTime || !a.endTime) continue;
    for (const s of active) {
      if (s.date !== a.date || !overlaps(a.startTime, a.endTime, s.startTime, s.endTime)) continue;
      if (a.courseId && s.courseId === a.courseId) continue;
      clashes.push({
        severity: "HIGH",
        rule: "OVERLAPS_CLASS",
        message: `${a.title} (${a.startTime}–${a.endTime}) overlaps your ${s.courseLabel} class on ${a.date}.`,
        hint: "You cannot invigilate and teach at once — shift the assessment or reschedule the class.",
        eventIds: [a.id],
        sessionId: s.id,
      });
    }
  }

  // Rule 4: assessment on a holiday / exam-week day.
  for (const a of assessments) {
    const title = blocked.get(a.date);
    if (title) {
      clashes.push({
        severity: "HIGH",
        rule: "ON_BLOCKED_DAY",
        message: `${a.title} is scheduled on ${a.date}, which is blocked by "${title}".`,
        hint: "Pick a teaching day; blocked days generate no classes.",
        eventIds: [a.id],
      });
    }
  }

  // Rule 5: assessment date arrives before the topics planned for that course have been logged as covered.
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const a of assessments) {
    if (!a.courseId) continue;
    const courseSessions = sessions.filter((s) => s.courseId === a.courseId);
    const covered = new Set(courseSessions.flatMap((s) => s.coveredTopics ?? []).map(norm));
    const plannedBefore = courseSessions.filter((s) => s.date < a.date && ["SCHEDULED", "MAKEUP", "HELD"].includes(s.status)).flatMap((s) => s.plannedTopics ?? []);
    const pastUncovered = courseSessions
      .filter((s) => s.date < a.date && s.status !== "HELD" && ["SCHEDULED", "CANCELLED", "HOLIDAY"].includes(s.status))
      .flatMap((s) => s.plannedTopics ?? [])
      .filter((t) => !covered.has(norm(t)));
    if (!plannedBefore.length || !pastUncovered.length) continue;
    const unique = [...new Set(pastUncovered)];
    clashes.push({
      severity: "LOW",
      rule: "UNTAUGHT_TOPICS",
      message: `${a.title} on ${a.date} assumes ${unique.length} topic${unique.length === 1 ? "" : "s"} not yet logged as covered: ${unique.slice(0, 3).join(", ")}${unique.length > 3 ? "…" : ""}.`,
      hint: "Log the classes where these were taught, or re-plan the remaining sessions before the assessment.",
      eventIds: [a.id],
    });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return clashes.sort((x, y) => order[x.severity] - order[y.severity]);
}
