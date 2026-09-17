const test = require("node:test");
const assert = require("node:assert/strict");
const { detectClashes } = require("../dist/services/schedule/clashes");
const { computeWorkload } = require("../dist/services/schedule/workload");

const ev = (id, over) => ({ id, kind: "ASSESSMENT", title: `Quiz ${id}`, date: "2026-09-20", endDate: null, courseId: 1, section: "A", startTime: null, endTime: null, ...over });
const sess = (id, over) => ({ id, date: "2026-09-20", startTime: "09:00", endTime: "10:30", status: "SCHEDULED", courseId: 2, courseLabel: "CSE305", section: "A", plannedTopics: null, coveredTopics: null, ...over });

test("clash: two assessments same section same day → HIGH", () => {
  const out = detectClashes([ev(1), ev(2, { title: "Mid" })], []);
  const same = out.filter((c) => c.rule === "SAME_DAY");
  assert.equal(same.length, 1);
  assert.equal(same[0].severity, "HIGH");
  assert.deepEqual(same[0].eventIds.sort(), [1, 2]);
});

test("clash: different sections same day is fine; three in one week → MEDIUM", () => {
  const out = detectClashes([ev(1, { section: "A" }), ev(2, { section: "B" })], []);
  assert.ok(!out.some((c) => c.rule === "SAME_DAY"));
  const week = detectClashes([ev(1, { date: "2026-09-20" }), ev(2, { date: "2026-09-22" }), ev(3, { date: "2026-09-24" })], []);
  assert.ok(week.some((c) => c.rule === "OVERLOADED_WEEK" && c.severity === "MEDIUM" && c.eventIds.length === 3));
});

test("clash: timed assessment overlapping own class of another course → HIGH; same course ignored", () => {
  const out = detectClashes([ev(1, { startTime: "09:30", endTime: "10:30" })], [sess(10)]);
  assert.ok(out.some((c) => c.rule === "OVERLAPS_CLASS" && c.sessionId === 10));
  const own = detectClashes([ev(1, { startTime: "09:30", endTime: "10:30", courseId: 2 })], [sess(10)]);
  assert.ok(!own.some((c) => c.rule === "OVERLAPS_CLASS"));
});

test("clash: assessment on a holiday → HIGH", () => {
  const out = detectClashes([ev(1), { id: 9, kind: "HOLIDAY", title: "Eid", date: "2026-09-19", endDate: "2026-09-21", courseId: null, section: null, startTime: null, endTime: null }], []);
  assert.ok(out.some((c) => c.rule === "ON_BLOCKED_DAY"));
});

test("clash: assessment before planned topics were logged as covered → LOW", () => {
  const sessions = [
    sess(1, { date: "2026-09-13", status: "HELD", courseId: 1, plannedTopics: ["Sets"], coveredTopics: ["Sets"] }),
    sess(2, { date: "2026-09-15", status: "CANCELLED", courseId: 1, plannedTopics: ["Relations"] }),
    sess(3, { date: "2026-09-17", status: "SCHEDULED", courseId: 1, plannedTopics: ["Functions"] }),
  ];
  const out = detectClashes([ev(1, { courseId: 1 })], sessions);
  const low = out.find((c) => c.rule === "UNTAUGHT_TOPICS");
  assert.ok(low, JSON.stringify(out));
  assert.match(low.message, /Relations/);
  assert.match(low.message, /Functions/);
  assert.ok(!/Sets/.test(low.message));
});

test("workload: hours per course/week, weekday split, cancellation rate", () => {
  const term = { startDate: "2026-09-06", endDate: "2026-10-03" }; // 4 weeks
  const sessions = [];
  for (const d of ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]) sessions.push({ date: d, startTime: "09:00", endTime: "10:30", status: "SCHEDULED", courseLabel: "CSE301", section: "A", kind: "LECTURE" });
  for (const d of ["2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]) sessions.push({ date: d, startTime: "14:00", endTime: "17:00", status: d === "2026-09-15" ? "CANCELLED" : "SCHEDULED", courseLabel: "CSE302", section: null, kind: "LAB" });
  sessions.push({ date: "2026-09-16", startTime: "14:00", endTime: "17:00", status: "MAKEUP", courseLabel: "CSE302", section: null, kind: "LAB" });
  const w = computeWorkload(term, sessions);
  assert.equal(w.totalWeeks, 4);
  assert.equal(w.perCourse.find((c) => c.courseLabel === "CSE301 (A)").hoursPerWeek, 1.5);
  assert.equal(w.perCourse.find((c) => c.courseLabel === "CSE302").hoursPerWeek, 3); // 3 sched + 1 makeup = 12h / 4
  assert.equal(w.perWeekday[0].classes, 4);
  assert.equal(w.cancellationRate, 12.5); // 1 of 8 planned
  assert.equal(w.makeupCoverage, 100);
  assert.equal(w.busiestDay, "Tuesday");
  assert.equal(w.heatmap.rows[0].cells[w.heatmap.hours.indexOf(9)], 4);
});
