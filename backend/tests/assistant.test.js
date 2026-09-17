const test = require("node:test");
const assert = require("node:assert/strict");
const { ASSISTANT_TOOLS, toolByName, toolCatalogue, toolsForRole } = require("../dist/services/assistant/assistant.tools");
const { localClock, isValidTimeZone } = require("../dist/services/schedule/dates");

test("assistant tools are role-scoped; admin-only tools never reach faculty", () => {
  const faculty = new Set(toolsForRole("FACULTY").map((t) => t.name));
  const admin = new Set(toolsForRole("ADMIN").map((t) => t.name));
  assert.ok(faculty.has("cancel_session") && !admin.has("cancel_session"));
  assert.ok(admin.has("import_department_routine") && !faculty.has("import_department_routine"));
  assert.ok(admin.has("set_user_role") && !faculty.has("set_user_role"));
  assert.ok(faculty.has("get_free_rooms") && admin.has("get_free_rooms"), "shared tool");
  assert.ok(faculty.has("import_my_routine"));
  assert.equal(toolCatalogue("ADMIN").some((c) => c.name === "log_session"), false);
  const imp = toolByName.get("import_my_routine").schema.safeParse({ attachmentId: "not-a-uuid" });
  assert.equal(imp.success, false);
});

test("localClock resolves date/hour per IANA zone and falls back for junk", () => {
  const now = new Date("2026-09-15T20:30:00Z");
  assert.deepEqual(localClock(now, "Asia/Dhaka"), { date: "2026-09-16", hour: 2 });
  assert.deepEqual(localClock(now, "America/Los_Angeles"), { date: "2026-09-15", hour: 13 });
  assert.equal(localClock(now, "Not/AZone").date.length, 10);
  assert.ok(isValidTimeZone("Europe/London"));
  assert.ok(!isValidTimeZone("Mars/Olympus"));
});

test("assistant tool registry: unique names, every tool has schema/label/run, catalogue sketches args", () => {
  const names = ASSISTANT_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of ASSISTANT_TOOLS) {
    assert.equal(typeof t.run, "function", t.name);
    assert.equal(typeof t.label, "function", t.name);
    assert.ok(t.schema && typeof t.schema.safeParse === "function", t.name);
  }
  const cat = toolCatalogue();
  const cancel = cat.find((c) => c.name === "cancel_session");
  assert.match(cancel.args, /sessionId: number/);
  assert.equal(cancel.mutating, true);
  const event = cat.find((c) => c.name === "add_calendar_event");
  assert.match(event.args, /"YYYY-MM-DD"/);
  assert.match(event.args, /"ASSESSMENT"/);
  const rs = cat.find((c) => c.name === "reschedule_session");
  assert.match(rs.args, /pick: "best"/);
});

test("assistant tool schemas apply defaults and reject junk ids", () => {
  const cancel = toolByName.get("cancel_session");
  assert.equal(cancel.schema.safeParse({ sessionId: "12" }).data.sessionId, 12);
  assert.equal(cancel.schema.safeParse({ sessionId: -1 }).success, false);
  const replan = toolByName.get("replan_course").schema.safeParse({ courseId: 68 });
  assert.equal(replan.data.apply, true);
  const notice = toolByName.get("draft_notice").schema.safeParse({ sessionId: 5 });
  assert.equal(notice.data.channel, "CHAT");
  const labels = { sessionLabel: (id) => `class #${id}`, courseLabel: (id) => `C${id}` };
  assert.match(cancel.label({ sessionId: 3, reason: "Sick" }, labels), /class #3.*Sick/);
});
