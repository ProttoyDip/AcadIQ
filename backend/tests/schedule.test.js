const test = require("node:test");
const assert = require("node:assert/strict");
const { generateSessions, findFreeSlots, blockedDates } = require("../dist/services/schedule/sessionGenerator");
const { addDays, dayOfWeek, weekIndex, eachDate, isValidIsoDate, spanDays, MAX_SPAN_DAYS } = require("../dist/services/schedule/dates");
const { buildIcs } = require("../dist/services/schedule/ics");

const term = { startDate: "2026-09-06", endDate: "2026-10-03" }; // Sun 6 Sep → Sat 3 Oct = 4 weeks
const slots = [
  { id: 1, courseId: 68, courseLabel: "CSE301", section: "A", dayOfWeek: 0, startTime: "09:00", endTime: "10:30", room: "R101", kind: "LECTURE" },
  { id: 2, courseId: 68, courseLabel: "CSE301", section: "A", dayOfWeek: 2, startTime: "09:00", endTime: "10:30", room: "R101", kind: "LECTURE" },
  { id: 3, courseId: null, courseLabel: "CSE305", section: null, dayOfWeek: 2, startTime: "14:00", endTime: "17:00", room: "Lab2", kind: "LAB" },
];

test("date helpers are timezone-free", () => {
  assert.equal(dayOfWeek("2026-09-06"), 0);
  assert.equal(addDays("2026-09-30", 3), "2026-10-03");
  assert.equal(eachDate("2026-09-28", "2026-10-01").length, 4);
  assert.equal(weekIndex("2026-09-06", "2026-09-06"), 1);
  assert.equal(weekIndex("2026-09-06", "2026-09-13"), 2);
  assert.ok(isValidIsoDate("2026-02-28"));
  assert.ok(!isValidIsoDate("2026-02-30"));
});

/**
 * Span caps. Before these, a single PATCH raising a term's endDate to 9999-12-31
 * burned ~4.5s and ~270MB expanding every date in between, then failed with an
 * opaque 500 — and because the term row commits before regeneration runs, the bad
 * date persisted and re-triggered the same cost on every later write to that term.
 * The same held for a calendar event with a far endDate, via /suggestions.
 */
test("eachDate refuses an absurd span but still serves normal ranges", () => {
  assert.throws(() => eachDate("2026-01-01", "9999-12-31"), RangeError);
  assert.equal(eachDate("2026-09-28", "2026-10-01").length, 4);
  assert.equal(eachDate("2026-09-06", addDays("2026-09-06", MAX_SPAN_DAYS)).length, MAX_SPAN_DAYS + 1, "exactly at the cap is allowed");
});

test("eachDate returns nothing for an inverted range", () => {
  assert.deepEqual(eachDate("2026-10-01", "2026-09-01"), []);
});

test("spanDays measures whole days and signs inverted ranges", () => {
  assert.equal(spanDays("2026-09-06", "2026-10-03"), 27);
  assert.equal(spanDays("2026-09-06", "2026-09-06"), 0);
  assert.ok(spanDays("2026-10-03", "2026-09-06") < 0);
});

test("blockedDates clamps an over-long event to the requested window", () => {
  const poison = [{ date: "2000-01-01", endDate: "9999-12-31", kind: "HOLIDAY", title: "Poison" }];
  const map = blockedDates(poison, { start: "2026-09-06", end: "2026-10-03" });
  assert.equal(map.size, 28, "only the 28 days of the window, not three million");
  assert.ok(map.has("2026-09-06") && map.has("2026-10-03"));
  assert.ok(!map.has("2026-10-04"));
});

test("blockedDates skips an event that falls entirely outside the window", () => {
  const map = blockedDates([{ date: "2020-01-01", endDate: "2020-01-05", kind: "HOLIDAY", title: "Ancient" }], { start: "2026-09-06", end: "2026-10-03" });
  assert.equal(map.size, 0);
});

test("generateSessions refuses a term wider than the span cap", () => {
  assert.throws(() => generateSessions({ startDate: "2026-01-01", endDate: "9999-12-31" }, slots, []), RangeError);
});

test("generateSessions survives a term-wide poison event", () => {
  const poison = [{ date: "2000-01-01", endDate: "9999-12-31", kind: "HOLIDAY", title: "Poison" }];
  const sessions = generateSessions(term, slots, poison);
  assert.equal(sessions.length, 12, "same 12 sessions as without the poison event");
  assert.ok(sessions.every((s) => s.status === "HOLIDAY"), "the event still blocks every day it covers");
});

test("findFreeSlots survives a poisoned calendar event", () => {
  const cancelled = { date: "2026-09-08", startTime: "09:00", endTime: "10:30", section: "A", courseLabel: "CSE301", room: "R101" };
  const poison = [{ date: "2000-01-01", endDate: "9999-12-31", kind: "HOLIDAY", title: "Poison" }];
  const out = findFreeSlots(cancelled, [], poison, { from: "2026-09-08", to: "2026-09-29" });
  assert.deepEqual(out, [], "every day in the window is blocked, and it returns instead of exhausting memory");
});

test("generateSessions expands slots across the term and marks holidays", () => {
  const events = [{ date: "2026-09-15", endDate: null, kind: "HOLIDAY", title: "Public holiday" }, { date: "2026-09-27", endDate: "2026-09-30", kind: "EXAM_WEEK", title: "Midterm week" }];
  const sessions = generateSessions(term, slots, events);
  assert.equal(sessions.length, 4 * 3, "3 slots × 4 weeks");
  const holidays = sessions.filter((s) => s.status === "HOLIDAY");
  // Tue 15 Sep (2 slots) + Sun 27 Sep (1) + Tue 29 Sep (2) = 5
  assert.equal(holidays.length, 5);
  assert.ok(holidays.every((h) => h.reason), "holiday sessions carry the event title");
  assert.deepEqual([...new Set(sessions.map((s) => s.plannedWeek))], [1, 2, 3, 4]);
  assert.equal(sessions[0].date, "2026-09-06");
  assert.ok(sessions.every((s, i, arr) => i === 0 || arr[i - 1].date <= s.date), "sorted by date");
});

test("blockedDates expands ranges and ignores deadlines", () => {
  const map = blockedDates([{ date: "2026-09-10", endDate: "2026-09-12", kind: "HOLIDAY", title: "Eid" }, { date: "2026-09-20", endDate: null, kind: "DEADLINE", title: "Marks due" }]);
  assert.equal(map.size, 3);
  assert.ok(!map.has("2026-09-20"));
});

test("findFreeSlots never proposes clashes and prefers same weekday/time", () => {
  const cancelled = { date: "2026-09-13", startTime: "09:00", endTime: "10:30", section: "A", courseLabel: "CSE301", room: "R101" };
  const existing = [
    // Faculty busy Mon 14th 09:00-12:00
    { id: 10, date: "2026-09-14", startTime: "09:00", endTime: "12:00", status: "SCHEDULED", section: "B", courseLabel: "CSE305", room: null },
    // Same section already has CSE301 on Tue 15th
    { id: 11, date: "2026-09-15", startTime: "11:00", endTime: "12:30", status: "SCHEDULED", section: "A", courseLabel: "CSE301", room: null },
    // Cancelled sessions must not block
    { id: 12, date: "2026-09-17", startTime: "09:00", endTime: "10:30", status: "CANCELLED", section: "A", courseLabel: "CSE301", room: null },
  ];
  const events = [{ date: "2026-09-16", endDate: null, kind: "HOLIDAY", title: "Holiday" }];
  const out = findFreeSlots(cancelled, existing, events, { from: "2026-09-13", to: "2026-09-27", limit: 6 });
  assert.equal(out.length, 6);
  assert.ok(!out.some((c) => c.date === cancelled.date && c.startTime === cancelled.startTime), "never offers the cancelled window back");
  for (const c of out) {
    assert.notEqual(c.date, "2026-09-16", "holiday excluded");
    assert.notEqual(dayOfWeek(c.date), 5, "Friday excluded by default");
    for (const e of existing.filter((e) => e.status !== "CANCELLED" && e.date === c.date)) {
      const overlap = c.startTime < e.endTime && e.startTime < c.endTime;
      assert.ok(!overlap, `clash ${c.date} ${c.startTime}`);
    }
  }
  const best = out[0];
  assert.equal(best.date, "2026-09-20", "next same weekday wins");
  assert.equal(best.startTime, "09:00");
  const tue = out.find((c) => c.date === "2026-09-15");
  if (tue) assert.ok(tue.reasons.some((r) => /already has this course/.test(r)));
  assert.ok(new Set(out.map((c) => c.date)).size >= 3, "diversified across dates");
});

test("buildIcs writes valid floating-time events with folding", () => {
  const ics = buildIcs("Test", [{ uid: "a@b", date: "2026-09-06", startTime: "09:00", endTime: "10:30", summary: "CSE301, Sec A; lecture", location: "R101", description: "x".repeat(120) }]);
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20260906T090000\r\n/);
  assert.match(ics, /SUMMARY:CSE301\\, Sec A\\; lecture/);
  assert.ok(ics.split("\r\n").every((l) => l.length <= 75), "lines folded to 75 octets");
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
