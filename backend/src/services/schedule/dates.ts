/**
 * Calendar arithmetic on `YYYY-MM-DD` / `HH:MM` strings. Everything is local-date
 * based so a faculty's timetable never shifts with the server's timezone.
 */

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function dayOfWeek(iso: string): number {
  return parseDate(iso).getUTCDay();
}

export function isValidIsoDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && toIso(parseDate(iso)) === iso;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/**
 * Span policy. `isValidIsoDate` accepts anything up to 9999-12-31, so without a
 * cap a single request can ask the generator to materialise ~3M dates per slot.
 * MAX_SPAN_DAYS is the backstop for `eachDate` itself: unreachable through the
 * validated routes, it exists so a row already in the database — written before
 * these caps existed — cannot re-trigger the same blow-up on every read.
 */
export const MAX_TERM_DAYS = 200;
export const MAX_EVENT_DAYS = 200;
export const MAX_SPAN_DAYS = 400;

/** Whole days from `startIso` to `endIso`; negative when the range is inverted. */
export function spanDays(startIso: string, endIso: string): number {
  return (parseDate(endIso).getTime() - parseDate(startIso).getTime()) / 86_400_000;
}

/** Inclusive list of ISO dates between two bounds. Empty when inverted. */
export function eachDate(startIso: string, endIso: string): string[] {
  if (spanDays(startIso, endIso) > MAX_SPAN_DAYS) {
    throw new RangeError(`Date range exceeds ${MAX_SPAN_DAYS} days (${startIso} to ${endIso})`);
  }
  const out: string[] = [];
  for (let d = startIso; d <= endIso; d = addDays(d, 1)) out.push(d);
  return out;
}

/** ISO week index (1-based) of `iso` relative to the term start's week (Sunday-start weeks). */
export function weekIndex(termStart: string, iso: string): number {
  const startOfWeek = addDays(termStart, -dayOfWeek(termStart));
  const diff = (parseDate(iso).getTime() - parseDate(startOfWeek).getTime()) / 86_400_000;
  return Math.floor(diff / 7) + 1;
}

export function todayIso(now = new Date()): string {
  // Local calendar date of the server; callers may pass the client's date instead.
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
