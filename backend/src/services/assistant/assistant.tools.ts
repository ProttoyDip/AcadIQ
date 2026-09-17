import { z } from "zod";
import { prisma } from "../../database/prismaClient";
import { AppError } from "../../middleware/error.middleware";
import { cancelSchema, eventBaseSchema, logSchema, rescheduleBaseSchema, scheduleService, sessionCreateBaseSchema } from "../schedule/schedule.service";
import { digestService } from "../schedule/digest.service";
import { departmentRoutineService, freeRoomsQuerySchema } from "../schedule/departmentRoutine.service";
import { generateRubricSchema, rubricService } from "../rubric.service";
import { lecturePlanSchema, lecturePlanService } from "../lecturePlan.service";
import { fullAnalysisService } from "../fullAnalysis.service";
import { questionRewriteService, rewriteQuestionSchema } from "../questionRewrite.service";
import { blueprintService } from "../blueprint.service";
import { fullAnalysisSchema } from "../../validators/analysis.validator";
import { routineImportService } from "../schedule/routineImport.service";
import { userRepository } from "../../repositories/user.repository";
import { attachmentStore } from "./attachments";

export type AssistantRole = "FACULTY" | "ADMIN";

const id = z.coerce.number().int().positive();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export interface AssistantTool<A = unknown> {
  name: string;
  description: string;
  /** Mutating tools are never executed from chat; they become pending actions the faculty confirms. */
  mutating: boolean;
  /** Who may call it; defaults to FACULTY only. */
  roles?: AssistantRole[];
  // Output type (defaults applied) so `run` sees `kind`, `apply`, `channel` as required.
  schema: z.ZodType<A, z.ZodTypeDef, unknown>;
  /** Human sentence shown in the confirmation card. */
  label: (args: A, ctx: LabelContext) => string;
  run: (userId: number, args: A) => Promise<unknown>;
}

export interface LabelContext {
  sessionLabel: (sessionId: number) => string;
  courseLabel: (courseId: number) => string;
  attachmentLabel: (attachmentId: string) => string;
}

function tool<A>(t: AssistantTool<A>): AssistantTool<unknown> {
  return t as unknown as AssistantTool<unknown>;
}

async function requireActiveTerm(facultyId: number) {
  const term = await scheduleService.activeTerm(facultyId);
  if (!term) throw new AppError("No active term — create one on the Schedule page first", 400);
  return term;
}

export const ASSISTANT_TOOLS: AssistantTool<unknown>[] = [
  tool({
    name: "cancel_session",
    description: "Cancel one scheduled class (it stays visible as cancelled and joins the make-up debt).",
    mutating: true,
    schema: cancelSchema.extend({ sessionId: id }),
    label: (a, c) => `Cancel ${c.sessionLabel(a.sessionId)}${a.reason ? ` — “${a.reason}”` : ""}`,
    run: (f, a) => scheduleService.cancelSession(f, a.sessionId, { reason: a.reason }),
  }),
  tool({
    name: "restore_session",
    description: "Undo a cancellation (only if no make-up was created).",
    mutating: true,
    schema: z.object({ sessionId: id }),
    label: (a, c) => `Restore ${c.sessionLabel(a.sessionId)}`,
    run: (f, a) => scheduleService.restoreSession(f, a.sessionId),
  }),
  tool({
    name: "reschedule_session",
    description: 'Move a class to a new slot (creates a MAKEUP). Either give date/startTime/endTime, or pick="best" to let the server choose the top clash-free suggestion.',
    mutating: true,
    schema: z.union([
      z.object({ sessionId: id, pick: z.literal("best"), reason: z.string().max(255).optional() }),
      rescheduleBaseSchema.extend({ sessionId: id }),
    ]),
    label: (a, c) => ("pick" in a ? `Move ${c.sessionLabel(a.sessionId)} to the best free slot` : `Move ${c.sessionLabel(a.sessionId)} to ${a.date} ${a.startTime}–${a.endTime}${a.room ? ` in ${a.room}` : ""}`),
    run: async (f, a) => {
      if ("pick" in a) {
        const { suggestions } = await scheduleService.suggestReschedule(f, a.sessionId);
        if (!suggestions.length) throw new AppError("No clash-free slot found in the next three weeks", 422);
        const best = suggestions[0];
        return scheduleService.rescheduleSession(f, a.sessionId, { date: best.date, startTime: best.startTime, endTime: best.endTime, room: best.room, reason: a.reason });
      }
      const { sessionId, ...rest } = a;
      return scheduleService.rescheduleSession(f, sessionId, rest);
    },
  }),
  tool({
    name: "log_session",
    description: "Mark a class as held and record the topics covered (plus optional notes).",
    mutating: true,
    schema: logSchema.extend({ sessionId: id }),
    label: (a, c) => `Log ${c.sessionLabel(a.sessionId)} as held: ${a.coveredTopics.join(", ") || "(no topics)"}`,
    run: (f, a) => scheduleService.logSession(f, a.sessionId, { coveredTopics: a.coveredTopics, notes: a.notes, materialIds: a.materialIds }),
  }),
  tool({
    name: "set_planned_topics",
    description: "Set what will be taught in a future class.",
    mutating: true,
    schema: z.object({ sessionId: id, plannedTopics: z.array(z.string().trim().min(1).max(200)).min(1).max(12) }),
    label: (a, c) => `Plan ${c.sessionLabel(a.sessionId)}: ${a.plannedTopics.join(", ")}`,
    run: (f, a) => scheduleService.updateSession(f, a.sessionId, { plannedTopics: a.plannedTopics }),
  }),
  tool({
    name: "add_session",
    description: "Add a one-off class (extra lecture, review session) to the active term.",
    mutating: true,
    schema: sessionCreateBaseSchema,
    label: (a) => `Add ${a.courseLabel}${a.section ? ` (${a.section})` : ""} on ${a.date} ${a.startTime}–${a.endTime}${a.room ? ` in ${a.room}` : ""}`,
    run: async (f, a) => scheduleService.createSession(f, (await requireActiveTerm(f)).id, a),
  }),
  tool({
    name: "add_calendar_event",
    description: "Add a holiday, exam week, deadline or assessment (quiz/mid/final) to the active term. Assessments may carry courseId, section, startTime, endTime.",
    mutating: true,
    schema: eventBaseSchema,
    label: (a, c) => `Add ${a.kind.toLowerCase().replace("_", " ")} “${a.title}” on ${a.date}${a.endDate ? ` → ${a.endDate}` : ""}${a.courseId ? ` for ${c.courseLabel(a.courseId)}` : ""}${a.startTime ? ` ${a.startTime}–${a.endTime ?? ""}` : ""}`,
    run: async (f, a) => scheduleService.addEvents(f, (await requireActiveTerm(f)).id, { events: [a] }),
  }),
  tool({
    name: "delete_calendar_event",
    description: "Remove a calendar event by id.",
    mutating: true,
    schema: z.object({ eventId: id }),
    label: (a) => `Delete calendar event #${a.eventId}`,
    run: async (f, a) => scheduleService.deleteEvent(f, (await requireActiveTerm(f)).id, a.eventId),
  }),
  tool({
    name: "draft_notice",
    description: "Draft a student notice (CHAT or EMAIL) for a cancelled/moved class. Read-only: returns text to copy.",
    mutating: false,
    schema: z.object({ sessionId: id, channel: z.enum(["CHAT", "EMAIL"]).default("CHAT") }),
    label: (a, c) => `Draft a ${a.channel.toLowerCase()} notice for ${c.sessionLabel(a.sessionId)}`,
    run: (f, a) => scheduleService.noticeDraft(f, a.sessionId, { channel: a.channel }),
  }),
  tool({
    name: "suggest_makeup_slots",
    description: "List clash-free make-up slots for a session. Read-only.",
    mutating: false,
    schema: z.object({ sessionId: id }),
    label: (a, c) => `Find make-up slots for ${c.sessionLabel(a.sessionId)}`,
    run: (f, a) => scheduleService.suggestReschedule(f, a.sessionId),
  }),
  tool({
    name: "replan_course",
    description: "AI re-distributes the remaining lecture-plan topics over the remaining sessions of a course. apply=false previews; apply=true writes planned topics.",
    mutating: true,
    schema: z.object({ courseId: id, note: z.string().max(1000).optional(), apply: z.boolean().default(true) }),
    label: (a, c) => `${a.apply ? "Re-plan and apply" : "Preview a re-plan of"} the remaining sessions of ${c.courseLabel(a.courseId)}${a.note ? ` (“${a.note}”)` : ""}`,
    run: (f, a) => scheduleService.replan(f, a),
  }),
  tool({
    name: "generate_rubric",
    description: "Draft an AI marking scheme for a question paper.",
    mutating: true,
    schema: generateRubricSchema,
    label: (a, c) => `Draft a marking scheme for paper #${a.questionPaperId} of ${c.courseLabel(a.courseId)}`,
    run: (f, a) => rubricService.generate(f, a),
  }),
  tool({
    name: "generate_lecture_plan",
    description: "Draft a week-by-week lecture plan for a course from its syllabus.",
    mutating: true,
    schema: lecturePlanSchema.extend({ courseId: id }),
    label: (a, c) => `Draft a ${a.weeks}-week lecture plan for ${c.courseLabel(a.courseId)}`,
    run: (f, a) => lecturePlanService.generate(f, a.courseId, { weeks: a.weeks, hoursPerWeek: a.hoursPerWeek, startNote: a.startNote }),
  }),
  tool({
    name: "run_full_analysis",
    description: "Run every exam analysis (quality, coverage, review, CO mapping, similarity) on a question paper.",
    mutating: true,
    schema: fullAnalysisSchema,
    label: (a, c) => `Run the full audit on paper #${a.questionPaperId} of ${c.courseLabel(a.courseId)}`,
    run: (f, a) => fullAnalysisService.analyze(f, a),
  }),
  tool({
    name: "rewrite_question",
    description: "Rewrite a stored question (by questionId) or pasted text: RAISE_BLOOM (needs targetBloom), VARIANT, CLARIFY, SPLIT, CUSTOM (needs instruction). Read-only.",
    mutating: false,
    schema: rewriteQuestionSchema,
    label: (a) => `Rewrite question ${a.questionId ? `#${a.questionId}` : ""} (${a.mode})`,
    run: (f, a) => questionRewriteService.rewrite(f, a),
  }),
  tool({
    name: "compare_blueprint",
    description: "Compare a paper against the course blueprint (Bloom/CO weightage). Read-only.",
    mutating: false,
    schema: z.object({ courseId: id, paperId: id }),
    label: (a, c) => `Compare paper #${a.paperId} with the ${c.courseLabel(a.courseId)} blueprint`,
    run: (f, a) => blueprintService.compare(f, a.courseId, a.paperId),
  }),
  tool({
    name: "get_pace",
    description: "Syllabus pace for a course (planned vs covered topics). Read-only.",
    mutating: false,
    schema: z.object({ courseId: id }),
    label: (a, c) => `Check pace for ${c.courseLabel(a.courseId)}`,
    run: (f, a) => scheduleService.pace(f, a.courseId),
  }),
  tool({
    name: "get_clashes",
    description: "Assessment clash report for the active term. Read-only.",
    mutating: false,
    schema: z.object({}),
    label: () => "Check assessment clashes",
    run: async (f) => scheduleService.clashes(f, (await requireActiveTerm(f)).id),
  }),
  tool({
    name: "get_free_rooms",
    description: "Rooms free at a date/time according to the department routine. Read-only.",
    mutating: false,
    roles: ["FACULTY", "ADMIN"],
    schema: freeRoomsQuerySchema,
    label: (a) => `Find free rooms on ${a.date} ${a.startTime}–${a.endTime}`,
    run: (_f, a) => departmentRoutineService.freeRooms(a),
  }),
  tool({
    name: "send_digest_now",
    description: "Email today's briefing to the faculty right now.",
    mutating: true,
    schema: z.object({}),
    label: () => "Email me today's briefing now",
    run: (f) => digestService.sendNow(f),
  }),
  tool({
    name: "export_course_file",
    description: "Prepare the course-file ZIP download link for a course. Read-only.",
    mutating: false,
    schema: z.object({ courseId: id }),
    label: (a, c) => `Prepare the course file for ${c.courseLabel(a.courseId)}`,
    run: async (f, a) => {
      const course = await prisma.course.findFirst({ where: { id: a.courseId, facultyId: f }, select: { id: true, courseCode: true } });
      if (!course) throw new AppError("Course not found", 404);
      return { downloadPath: `/courses/${course.id}/course-file.zip`, courseCode: course.courseCode };
    },
  }),
  tool({
    name: "import_my_routine",
    description: "Read an attached routine file/photo (see CONTEXT.attachments) and save this faculty's classes as weekly slots in the active term, rebuilding the calendar. Set allRowsAreMine=true when the user says the routine is theirs / all classes are mine / has no teacher column; otherwise rows are filtered by name or the given initials.",
    mutating: true,
    schema: z.object({ attachmentId: z.string().uuid(), initials: z.string().trim().max(12).optional(), allRowsAreMine: z.boolean().default(false), replace: z.boolean().default(true) }),
    label: (a, c) => `Import my weekly slots from ${c.attachmentLabel(a.attachmentId)}${a.allRowsAreMine ? " (every row is mine)" : a.initials ? ` (rows marked ${a.initials})` : ""}${a.replace ? ", replacing existing slots" : ""}`,
    run: async (f, a) => {
      const term = await requireActiveTerm(f);
      const file = attachmentStore.get(f, a.attachmentId);
      const extracted = await routineImportService.extract(f, file, { initials: a.initials, allRowsAreMine: a.allRowsAreMine, keepFile: true });
      const saved = await scheduleService.saveSlots(f, term.id, {
        slots: extracted.slots.map(({ confidence: _c, matchedCourse: _m, teacher: _t, ...s }) => ({ ...s, source: "AI_IMPORT" as const })),
        replace: a.replace,
      });
      attachmentStore.consume(a.attachmentId);
      return { imported: extracted.slots.length, sessions: saved.sessions, lowConfidence: extracted.lowConfidence, method: extracted.method, scope: extracted.scope, warnings: extracted.warnings };
    },
  }),

  // ---- ADMIN ----
  tool({
    name: "import_department_routine",
    description: "ADMIN: read an attached department routine file/photo (see CONTEXT.attachments) and store every row (all teachers, rooms, sections). Replaces the current routine unless replace=false.",
    mutating: true,
    roles: ["ADMIN"],
    schema: z.object({ attachmentId: z.string().uuid(), termLabel: z.string().trim().min(2).max(80).default("Current term"), replace: z.boolean().default(true) }),
    label: (a, c) => `Import the department routine from ${c.attachmentLabel(a.attachmentId)} as “${a.termLabel}”${a.replace ? " (replace current)" : ""}`,
    run: async (u, a) => {
      const file = attachmentStore.get(u, a.attachmentId);
      const result = await departmentRoutineService.import(u, file, { termLabel: a.termLabel, replace: a.replace }, { keepFile: true });
      attachmentStore.consume(a.attachmentId);
      return result;
    },
  }),
  tool({
    name: "list_department_routines",
    description: "ADMIN: list uploaded department routines. Read-only.",
    mutating: false,
    roles: ["ADMIN"],
    schema: z.object({}),
    label: () => "List department routines",
    run: () => departmentRoutineService.list(),
  }),
  tool({
    name: "delete_department_routine",
    description: "ADMIN: delete a department routine by id (use ids from CONTEXT.departmentRoutines).",
    mutating: true,
    roles: ["ADMIN"],
    schema: z.object({ routineId: id }),
    label: (a) => `Delete department routine #${a.routineId}`,
    run: (_u, a) => departmentRoutineService.remove(a.routineId),
  }),
  tool({
    name: "list_users",
    description: "ADMIN: list platform users with roles. Read-only.",
    mutating: false,
    roles: ["ADMIN"],
    schema: z.object({}),
    label: () => "List users",
    run: async () => (await userRepository.listAll()).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
  }),
  tool({
    name: "set_user_role",
    description: "ADMIN: change a user's role to ADMIN or FACULTY (use ids from CONTEXT.users).",
    mutating: true,
    roles: ["ADMIN"],
    schema: z.object({ userId: id, role: z.enum(["ADMIN", "FACULTY"]) }),
    label: (a) => `Make user #${a.userId} ${a.role}`,
    run: async (u, a) => {
      if (a.userId === u) throw new AppError("You cannot change your own role", 422);
      return userRepository.updateRole(a.userId, a.role);
    },
  }),
];

export const toolByName = new Map(ASSISTANT_TOOLS.map((t) => [t.name, t]));

export function toolsForRole(role: AssistantRole) {
  return ASSISTANT_TOOLS.filter((t) => (t.roles ?? ["FACULTY"]).includes(role));
}

/** Compact catalogue for the planner prompt: zod → a readable arg sketch. */
export function toolCatalogue(role: AssistantRole = "FACULTY") {
  return toolsForRole(role).map((t) => ({ name: t.name, description: t.description, args: sketch(t.schema), mutating: t.mutating }));
}

function sketch(schema: z.ZodTypeAny): string {
  const def = schema._def as { typeName?: string };
  if (def.typeName === "ZodEffects") return sketch((schema as z.ZodEffects<z.ZodTypeAny>).innerType());
  if (def.typeName === "ZodUnion") return (schema as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>).options.map(sketch).join(" | ");
  if (def.typeName === "ZodObject") {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    return `{ ${Object.entries(shape)
      .map(([k, v]) => `${k}${v.isOptional() ? "?" : ""}: ${sketchLeaf(v)}`)
      .join(", ")} }`;
  }
  return sketchLeaf(schema);
}

function sketchLeaf(schema: z.ZodTypeAny): string {
  let s: z.ZodTypeAny = schema;
  for (;;) {
    const def = s._def as { typeName?: string; innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny };
    if (def.typeName === "ZodOptional" || def.typeName === "ZodNullable" || def.typeName === "ZodDefault") s = def.innerType!;
    else if (def.typeName === "ZodEffects") s = def.schema!;
    else break;
  }
  const def = s._def as { typeName?: string; values?: string[]; value?: unknown; type?: z.ZodTypeAny; checks?: Array<{ kind: string; regex?: RegExp }> };
  switch (def.typeName) {
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodEnum":
      return def.values!.map((v) => `"${v}"`).join("|");
    case "ZodLiteral":
      return JSON.stringify(def.value);
    case "ZodArray":
      return `${sketchLeaf(def.type!)}[]`;
    case "ZodObject":
      return sketch(s);
    case "ZodString": {
      const regex = def.checks?.find((c) => c.kind === "regex")?.regex?.source ?? "";
      return regex.includes("\\d{4}-") ? '"YYYY-MM-DD"' : regex.includes(":[0-5]") ? '"HH:MM"' : "string";
    }
    default:
      return "any";
  }
}
