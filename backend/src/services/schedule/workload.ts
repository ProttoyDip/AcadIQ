import { DAY_NAMES, dayOfWeek, toMinutes, weekIndex } from "./dates";

export interface WorkloadSession {
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  courseLabel: string;
  section: string | null;
  kind: string;
}

export interface WorkloadReport {
  contactHoursPerWeek: number;
  perCourse: Array<{ courseLabel: string; hoursPerWeek: number; sessions: number; held: number; cancelled: number; makeups: number }>;
  perWeekday: Array<{ day: string; dayOfWeek: number; hours: number; classes: number }>;
  /** rows = weekday 0..6, cols = hour 7..19 → number of scheduled classes touching that hour across the term. */
  heatmap: { hours: number[]; rows: Array<{ dayOfWeek: number; day: string; cells: number[] }> };
  statusCounts: Record<string, number>;
  cancellationRate: number;
  makeupCoverage: number;
  busiestDay: string | null;
  peakWeeks: Array<{ week: number; hours: number }>;
  totalWeeks: number;
}

const hours = (s: { startTime: string; endTime: string }) => (toMinutes(s.endTime) - toMinutes(s.startTime)) / 60;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const TEACHING = new Set(["SCHEDULED", "MAKEUP", "HELD"]);

export function computeWorkload(term: { startDate: string; endDate: string }, sessions: WorkloadSession[]): WorkloadReport {
  const totalWeeks = Math.max(1, weekIndex(term.startDate, term.endDate));
  const teaching = sessions.filter((s) => TEACHING.has(s.status));

  const perCourseMap = new Map<string, { hours: number; sessions: number; held: number; cancelled: number; makeups: number }>();
  for (const s of sessions) {
    const key = `${s.courseLabel}${s.section ? ` (${s.section})` : ""}`;
    const row = perCourseMap.get(key) ?? { hours: 0, sessions: 0, held: 0, cancelled: 0, makeups: 0 };
    if (TEACHING.has(s.status)) {
      row.hours += hours(s);
      row.sessions += 1;
    }
    if (s.status === "HELD") row.held += 1;
    if (s.status === "CANCELLED" || s.status === "HOLIDAY") row.cancelled += 1;
    if (s.status === "MAKEUP") row.makeups += 1;
    perCourseMap.set(key, row);
  }
  const perCourse = [...perCourseMap.entries()]
    .map(([courseLabel, r]) => ({ courseLabel, hoursPerWeek: round(r.hours / totalWeeks), sessions: r.sessions, held: r.held, cancelled: r.cancelled, makeups: r.makeups }))
    .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);

  const perWeekday = DAY_NAMES.map((day, dayOfWeekIndex) => {
    const items = teaching.filter((s) => dayOfWeek(s.date) === dayOfWeekIndex);
    return { day, dayOfWeek: dayOfWeekIndex, hours: round(items.reduce((sum, s) => sum + hours(s), 0) / totalWeeks), classes: items.length };
  });

  const hourAxis = Array.from({ length: 13 }, (_, i) => 7 + i);
  const heatRows = DAY_NAMES.map((day, dow) => ({
    dayOfWeek: dow,
    day,
    cells: hourAxis.map((h) => teaching.filter((s) => dayOfWeek(s.date) === dow && toMinutes(s.startTime) < (h + 1) * 60 && toMinutes(s.endTime) > h * 60).length),
  }));

  const statusCounts: Record<string, number> = {};
  for (const s of sessions) statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  const lost = (statusCounts.CANCELLED ?? 0) + (statusCounts.HOLIDAY ?? 0) + (statusCounts.RESCHEDULED ?? 0);
  const planned = sessions.filter((s) => s.status !== "MAKEUP").length;
  const cancellationRate = planned ? round((lost / planned) * 100) : 0;
  const makeupCoverage = lost ? round(((statusCounts.MAKEUP ?? 0) / lost) * 100) : 100;

  const weekHours = new Map<number, number>();
  for (const s of teaching) {
    const w = weekIndex(term.startDate, s.date);
    weekHours.set(w, (weekHours.get(w) ?? 0) + hours(s));
  }
  const avg = teaching.reduce((sum, s) => sum + hours(s), 0) / totalWeeks;
  const peakWeeks = [...weekHours.entries()]
    .filter(([, h]) => h > avg * 1.25 && h > 0)
    .map(([week, h]) => ({ week, hours: round(h) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 4);

  const busiest = perWeekday.reduce<(typeof perWeekday)[number] | null>((best, d) => (d.hours > (best?.hours ?? 0) ? d : best), null);

  return {
    contactHoursPerWeek: round(avg),
    perCourse,
    perWeekday,
    heatmap: { hours: hourAxis, rows: heatRows },
    statusCounts,
    cancellationRate,
    makeupCoverage,
    busiestDay: busiest?.day ?? null,
    peakWeeks,
    totalWeeks,
  };
}
