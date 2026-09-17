import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../database/prismaClient";
import { AppError } from "../../middleware/error.middleware";
import { env } from "../../config/env";
import { runLlmAnalysis } from "../../ai/runner";
import { ASSISTANT_PLANNER_PROMPT } from "../../ai/prompts/assistant.prompt";
import { assistantPlannerResponseSchema } from "../../ai/schemas/facultyWorkflows.schema";
import { tracedAnalysis } from "../traced";
import { auditService } from "../audit.service";
import { logger } from "../../utils/logger";
import { scheduleService } from "../schedule/schedule.service";
import { addDays, DAY_NAMES, dayOfWeek, todayIso } from "../schedule/dates";
import { ASSISTANT_TOOLS, AssistantRole, LabelContext, toolByName, toolCatalogue, toolsForRole } from "./assistant.tools";
import { attachmentStore } from "./attachments";
import { departmentRoutineService } from "../schedule/departmentRoutine.service";
import { userRepository } from "../../repositories/user.repository";

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(12).default([]),
  page: z.object({ path: z.string().max(200).optional(), courseId: z.coerce.number().int().positive().optional(), paperId: z.coerce.number().int().positive().optional(), reportId: z.coerce.number().int().positive().optional() }).optional(),
  clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ChatInput = z.infer<typeof chatSchema>;

export const executeSchema = z.object({
  actionToken: z.string().min(10).max(200),
  actions: z.array(z.object({ tool: z.string(), args: z.record(z.unknown()) })).min(1).max(8),
  skip: z.array(z.number().int().min(0)).max(8).default([]),
});

export interface PendingAction {
  index: number;
  tool: string;
  args: Record<string, unknown>;
  label: string;
  why: string;
  mutating: boolean;
}

const TOKEN_TTL_MS = 15 * 60_000;

function sign(facultyId: number, actions: Array<{ tool: string; args: unknown }>, exp: number) {
  return createHmac("sha256", env.jwtSecret).update(`${facultyId}|${exp}|${JSON.stringify(actions)}`).digest("hex");
}

function mintToken(facultyId: number, actions: Array<{ tool: string; args: unknown }>) {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${sign(facultyId, actions, exp)}`;
}

function verifyToken(facultyId: number, actions: Array<{ tool: string; args: unknown }>, token: string) {
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !sig) throw new AppError("Invalid action token", 400);
  if (Date.now() > exp) throw new AppError("These proposed actions have expired — ask again", 410);
  const expected = sign(facultyId, actions, exp);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) throw new AppError("Action token does not match the proposed actions", 400);
}

/** What the planner sees: the faculty's near-term calendar and courses with real ids. */
async function buildAdminContext(userId: number, input: ChatInput) {
  const today = input.clientDate ?? todayIso();
  const [routines, users] = await Promise.all([departmentRoutineService.list(), userRepository.listAll()]);
  return {
    role: "ADMIN" as const,
    today,
    todayWeekday: DAY_NAMES[dayOfWeek(today)],
    page: input.page ?? null,
    attachments: attachmentStore.listFor(userId),
    departmentRoutines: routines.map((r) => ({ id: r.id, termLabel: r.termLabel, file: r.originalName, slots: r.slotCount, uploadedAt: r.createdAt.toISOString().slice(0, 10) })),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    // Faculty-only fields kept present (empty) so the label helpers and id checks stay uniform.
    term: null,
    courses: [] as Array<{ id: number; code: string; name: string }>,
    sessions: [] as Array<{ id: number; courseLabel: string; section: string | null; weekday: string; date: string; startTime: string; endTime: string }>,
  };
}

async function buildContext(facultyId: number, input: ChatInput) {
  const today = input.clientDate ?? todayIso();
  const term = await scheduleService.activeTerm(facultyId);
  const [courses, sessions, debt, events] = await Promise.all([
    prisma.course.findMany({
      where: { facultyId },
      select: { id: true, courseCode: true, courseName: true, questionPapers: { select: { id: true, year: true, semester: true }, orderBy: [{ year: "desc" }, { uploadedAt: "desc" }] }, syllabusDocuments: { select: { id: true }, take: 1 } },
      orderBy: { courseCode: "asc" },
    }),
    term
      ? prisma.classSession.findMany({
          where: { termId: term.id, date: { gte: addDays(today, -7), lte: addDays(today, 14) } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: { id: true, date: true, startTime: true, endTime: true, courseId: true, courseLabel: true, section: true, room: true, kind: true, status: true, plannedTopics: true, coveredTopics: true, reason: true },
        })
      : Promise.resolve([]),
    term ? scheduleService.makeupDebt(facultyId, term.id) : Promise.resolve(null),
    term
      ? prisma.calendarEvent.findMany({ where: { termId: term.id, date: { gte: addDays(today, -7), lte: addDays(today, 30) } }, select: { id: true, date: true, endDate: true, kind: true, title: true, courseId: true, section: true, startTime: true, endTime: true }, orderBy: { date: "asc" } })
      : Promise.resolve([]),
  ]);
  const paceByCourse: Record<string, string> = {};
  if (term) {
    for (const c of courses) {
      try {
        const p = await scheduleService.pace(facultyId, c.id);
        paceByCourse[c.courseCode] = `${p.status}: ${p.coveredTopics.length}/${p.plannedTopics.length} topics covered, ${p.sessions.remaining} sessions left`;
      } catch {
        /* pace is best-effort context */
      }
    }
  }
  return {
    role: "FACULTY" as const,
    today,
    todayWeekday: DAY_NAMES[dayOfWeek(today)],
    page: input.page ?? null,
    attachments: attachmentStore.listFor(facultyId),
    term: term ? { id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate } : null,
    courses: courses.map((c) => ({ id: c.id, code: c.courseCode, name: c.courseName, hasSyllabus: c.syllabusDocuments.length > 0, papers: c.questionPapers.map((p) => ({ id: p.id, label: `${p.semester} ${p.year}` })) })),
    sessions: sessions.map((s) => ({ ...s, weekday: DAY_NAMES[dayOfWeek(s.date)], plannedTopics: (s.plannedTopics as string[] | null) ?? [], coveredTopics: (s.coveredTopics as string[] | null) ?? [] })),
    makeupDebt: debt ? { total: debt.total, owed: debt.courses.flatMap((c) => c.owed.map((o) => ({ sessionId: o.id, course: c.courseLabel, date: o.date, startTime: o.startTime }))) } : null,
    calendarEvents: events,
    pace: paceByCourse,
  };
}

type AnyContext = Awaited<ReturnType<typeof buildContext>> | Awaited<ReturnType<typeof buildAdminContext>>;

function labelContext(ctx: AnyContext): LabelContext {
  const sessions = new Map(ctx.sessions.map((s) => [s.id, s]));
  const courses = new Map(ctx.courses.map((c) => [c.id, c]));
  const attachments = new Map(ctx.attachments.map((a) => [a.id, a]));
  return {
    sessionLabel: (id) => {
      const s = sessions.get(id);
      return s ? `${s.courseLabel}${s.section ? ` (${s.section})` : ""} on ${s.weekday} ${s.date} ${s.startTime}–${s.endTime}` : `class #${id}`;
    },
    courseLabel: (id) => courses.get(id)?.code ?? `course #${id}`,
    attachmentLabel: (id) => attachments.get(id)?.name ?? "the attached file",
  };
}

export const assistantService = {
  chat(userId: number, role: AssistantRole, input: ChatInput) {
    return tracedAnalysis(async () => {
      const context: AnyContext = role === "ADMIN" ? await buildAdminContext(userId, input) : await buildContext(userId, input);
      const { consensus } = await runLlmAnalysis(
        ASSISTANT_PLANNER_PROMPT,
        [{ message: input.message, history: input.history.slice(-8), context, tools: toolCatalogue(role) }],
        assistantPlannerResponseSchema,
        { cache: false, temperature: 0.2 }
      );

      const labels = labelContext(context);
      const pending: PendingAction[] = [];
      const rejected: Array<{ tool: string; reason: string }> = [];
      const knownSessionIds = new Set(context.sessions.map((s) => s.id));
      const knownCourseIds = new Set(context.courses.map((c) => c.id));
      const knownAttachmentIds = new Set(context.attachments.map((a) => a.id));
      const allowed = new Set(toolsForRole(role).map((t) => t.name));
      for (const action of consensus.actions ?? []) {
        const tool = toolByName.get(action.tool);
        if (!tool || !allowed.has(tool.name)) {
          rejected.push({ tool: action.tool, reason: tool ? "not available for your role" : "unknown tool" });
          continue;
        }
        const parsed = tool.schema.safeParse(action.args);
        if (!parsed.success) {
          rejected.push({ tool: action.tool, reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
          continue;
        }
        const args = parsed.data as Record<string, unknown>;
        // The planner may only reference ids it was shown.
        if (typeof args.sessionId === "number" && !knownSessionIds.has(args.sessionId)) {
          rejected.push({ tool: action.tool, reason: `session #${args.sessionId} is not in your recent calendar` });
          continue;
        }
        if (typeof args.courseId === "number" && !knownCourseIds.has(args.courseId)) {
          rejected.push({ tool: action.tool, reason: `course #${args.courseId} is not yours` });
          continue;
        }
        if (typeof args.attachmentId === "string" && !knownAttachmentIds.has(args.attachmentId)) {
          rejected.push({ tool: action.tool, reason: "that attachment is not in this chat" });
          continue;
        }
        pending.push({ index: pending.length, tool: tool.name, args, label: tool.label(args, labels), why: action.why ?? "", mutating: tool.mutating });
      }

      // Read-only tools run immediately — unless they read a session another pending
      // action is about to change (e.g. "draft a notice" after "move the class"), in
      // which case they are deferred so they see the post-confirmation state.
      const mutatedSessions = new Set(pending.filter((p) => p.mutating).map((p) => p.args.sessionId).filter((v): v is number => typeof v === "number"));
      const results: Array<{ tool: string; ok: boolean; result?: unknown; error?: string; label: string }> = [];
      const remaining: PendingAction[] = [];
      for (const p of pending) {
        const dependsOnMutation = !p.mutating && typeof p.args.sessionId === "number" && mutatedSessions.has(p.args.sessionId);
        if (p.mutating || dependsOnMutation) {
          remaining.push(p);
          continue;
        }
        try {
          results.push({ tool: p.tool, label: p.label, ok: true, result: await toolByName.get(p.tool)!.run(userId, p.args) });
        } catch (error) {
          results.push({ tool: p.tool, label: p.label, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      const signable = remaining.map((p) => ({ tool: p.tool, args: p.args }));
      return {
        reply: consensus.reply,
        followUpQuestion: consensus.followUpQuestion ?? null,
        navigate: consensus.navigate ?? null,
        pendingActions: remaining.map((p, index) => ({ ...p, index })),
        actionToken: remaining.length ? mintToken(userId, signable) : null,
        results,
        rejected,
        context: { today: context.today, term: context.term?.name ?? null, makeupDebt: "makeupDebt" in context ? context.makeupDebt?.total ?? 0 : 0 },
      };
    });
  },

  async execute(userId: number, role: AssistantRole, input: z.infer<typeof executeSchema>) {
    verifyToken(userId, input.actions, input.actionToken);
    const allowed = new Set(toolsForRole(role).map((t) => t.name));
    const skip = new Set(input.skip);
    const results: Array<{ index: number; tool: string; ok: boolean; skipped?: boolean; result?: unknown; error?: string }> = [];
    for (let i = 0; i < input.actions.length; i += 1) {
      const action = input.actions[i];
      if (skip.has(i)) {
        results.push({ index: i, tool: action.tool, ok: true, skipped: true });
        continue;
      }
      const tool = toolByName.get(action.tool);
      if (!tool || !allowed.has(tool.name)) {
        results.push({ index: i, tool: action.tool, ok: false, error: tool ? "not available for your role" : "unknown tool" });
        continue;
      }
      const parsed = tool.schema.safeParse(action.args);
      if (!parsed.success) {
        results.push({ index: i, tool: action.tool, ok: false, error: "invalid arguments" });
        continue;
      }
      try {
        const result = await tool.run(userId, parsed.data);
        results.push({ index: i, tool: action.tool, ok: true, result });
        await auditService.recordAuditLog({ userId, action: `Assistant executed ${action.tool}`, document: JSON.stringify(parsed.data).slice(0, 250) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ index: i, tool: action.tool, ok: false, error: message });
        logger.warn("assistant_action_failed", { userId, tool: action.tool, reason: message });
      }
    }
    const done = results.filter((r) => r.ok && !r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;
    return {
      results,
      summary: `${done} action${done === 1 ? "" : "s"} done${failed ? `, ${failed} failed` : ""}${skip.size ? `, ${skip.size} skipped` : ""}.`,
    };
  },

  tools: (role: AssistantRole = "FACULTY") => toolsForRole(role).map((t) => ({ name: t.name, description: t.description, mutating: t.mutating })),

  stageAttachment(userId: number, file: { path: string; mimetype: string; originalname: string; size: number }) {
    const entry = attachmentStore.stage(userId, file);
    return { id: entry.id, name: entry.originalname, mimetype: entry.mimetype, size: entry.size };
  },

  discardAttachment(userId: number, id: string) {
    attachmentStore.get(userId, id);
    attachmentStore.consume(id);
    return { id };
  },
};

// Keep the export list stable for tests that import the full registry.
export { ASSISTANT_TOOLS };
