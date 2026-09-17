import { z } from "zod";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prismaClient";
import { AppError } from "../../middleware/error.middleware";
import { env } from "../../config/env";
import { runLlmAnalysis } from "../../ai/runner";
import { CLASS_NOTICE_PROMPT, PACE_REPLAN_PROMPT } from "../../ai/prompts/timetable.prompt";
import { classNoticeResponseSchema, paceReplanResponseSchema } from "../../ai/schemas/facultyWorkflows.schema";
import { tracedAnalysis } from "../traced";
import { auditService } from "../audit.service";
import { addDays, DAY_NAMES, isValidIsoDate, MAX_EVENT_DAYS, MAX_TERM_DAYS, spanDays, todayIso, toMinutes } from "./dates";
import { findFreeSlots, generateSessions } from "./sessionGenerator";
import { buildIcs } from "./ics";
import { detectClashes } from "./clashes";
import { computeWorkload } from "./workload";
import { departmentRoutineService } from "./departmentRoutine.service";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM expected");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD expected").refine(isValidIsoDate, "YYYY-MM-DD expected");
const timeRange = <T extends { startTime: string; endTime: string }>(v: T) => toMinutes(v.endTime) > toMinutes(v.startTime);

const termBase = z.object({
  name: z.string().trim().min(2).max(80),
  startDate: isoDate,
  endDate: isoDate,
});
export const termSchema = termBase
  .refine((v) => v.endDate > v.startDate, { message: "endDate must be after startDate", path: ["endDate"] })
  .refine((v) => spanDays(v.startDate, v.endDate) <= MAX_TERM_DAYS, { message: `A term cannot exceed ${MAX_TERM_DAYS} days`, path: ["endDate"] });

// `.partial()` cannot carry termSchema's cross-field refinements: either date may
// be absent on a PATCH, so the rule is only decidable once merged with the stored
// term. This checks the both-present case for a well-shaped 422; `updateTerm`
// performs the authoritative check against the merged dates.
export const termUpdateSchema = termBase
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.startDate || !v.endDate) return;
    if (v.endDate <= v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endDate must be after startDate", path: ["endDate"] });
    } else if (spanDays(v.startDate, v.endDate) > MAX_TERM_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `A term cannot exceed ${MAX_TERM_DAYS} days`, path: ["endDate"] });
    }
  });

export const slotSchema = z
  .object({
    courseId: z.coerce.number().int().positive().nullable().optional(),
    courseLabel: z.string().trim().min(1).max(120),
    section: z.string().trim().max(40).nullable().optional(),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: hhmm,
    endTime: hhmm,
    room: z.string().trim().max(60).nullable().optional(),
    kind: z.enum(["LECTURE", "LAB", "TUTORIAL", "OFFICE_HOUR", "OTHER"]).default("LECTURE"),
    source: z.enum(["MANUAL", "AI_IMPORT"]).default("MANUAL"),
  })
  .refine(timeRange, { message: "endTime must be after startTime", path: ["endTime"] });
export type SlotInput = z.infer<typeof slotSchema>;

export const slotsBulkSchema = z.object({ slots: z.array(slotSchema).min(1).max(80), replace: z.boolean().default(false) });

export const eventBaseSchema = z.object({
  date: isoDate,
  endDate: isoDate.nullable().optional(),
  kind: z.enum(["HOLIDAY", "EXAM_WEEK", "DEADLINE", "ASSESSMENT", "OTHER"]),
  title: z.string().trim().min(1).max(160),
  courseId: z.coerce.number().int().positive().nullable().optional(),
  section: z.string().trim().max(40).nullable().optional(),
  startTime: hhmm.nullable().optional(),
  endTime: hhmm.nullable().optional(),
});
export const eventSchema = eventBaseSchema
  .refine((v) => !v.endDate || v.endDate >= v.date, { message: "endDate must be on or after date", path: ["endDate"] })
  .refine((v) => !v.endDate || spanDays(v.date, v.endDate) <= MAX_EVENT_DAYS, {
    message: `An event cannot exceed ${MAX_EVENT_DAYS} days`,
    path: ["endDate"],
  })
  .refine((v) => !(v.startTime && v.endTime) || toMinutes(v.endTime) > toMinutes(v.startTime), { message: "endTime must be after startTime", path: ["endTime"] });
export const eventsBulkSchema = z.object({ events: z.array(eventSchema).min(1).max(100) });

export const sessionCreateBaseSchema = z.object({
  courseId: z.coerce.number().int().positive().nullable().optional(),
  courseLabel: z.string().trim().min(1).max(120),
  section: z.string().trim().max(40).nullable().optional(),
  date: isoDate,
  startTime: hhmm,
  endTime: hhmm,
  room: z.string().trim().max(60).nullable().optional(),
  kind: z.enum(["LECTURE", "LAB", "TUTORIAL", "OFFICE_HOUR", "OTHER"]).default("LECTURE"),
  plannedTopics: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
});
export const sessionCreateSchema = sessionCreateBaseSchema.refine(timeRange, { message: "endTime must be after startTime", path: ["endTime"] });

export const sessionUpdateSchema = z
  .object({
    date: isoDate.optional(),
    startTime: hhmm.optional(),
    endTime: hhmm.optional(),
    room: z.string().trim().max(60).nullable().optional(),
    plannedTopics: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
    status: z.enum(["SCHEDULED", "HELD"]).optional(),
  })
  .strict();

export const cancelSchema = z.object({ reason: z.string().trim().max(255).optional() });

export const rescheduleBaseSchema = z.object({
  date: isoDate,
  startTime: hhmm,
  endTime: hhmm,
  room: z.string().trim().max(60).nullable().optional(),
  reason: z.string().trim().max(255).optional(),
});
export const rescheduleSchema = rescheduleBaseSchema.refine(timeRange, { message: "endTime must be after startTime", path: ["endTime"] });

export const logSchema = z.object({
  coveredTopics: z.array(z.string().trim().min(1).max(200)).max(20),
  notes: z.string().trim().max(2000).optional(),
  materialIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
});

export const rangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  courseId: z.coerce.number().int().positive().optional(),
});

export const noticeSchema = z.object({ channel: z.enum(["EMAIL", "CHAT"]).default("CHAT") });

export const replanSchema = z.object({ courseId: z.coerce.number().int().positive(), note: z.string().trim().max(1000).optional(), apply: z.boolean().default(false) });

async function ownedTerm(facultyId: number, termId: number) {
  const term = await prisma.term.findFirst({ where: { id: termId, facultyId } });
  if (!term) throw new AppError("Term not found", 404);
  return term;
}

async function ownedSession(facultyId: number, sessionId: number) {
  const session = await prisma.classSession.findFirst({ where: { id: sessionId, term: { facultyId } }, include: { term: true } });
  if (!session) throw new AppError("Class session not found", 404);
  return session;
}

/** Resolves a slot's courseLabel to one of the faculty's courses by code prefix, so sessions link to syllabus/plan. */
async function matchCourseId(facultyId: number, label: string, explicit?: number | null): Promise<number | null> {
  if (explicit) {
    const course = await prisma.course.findFirst({ where: { id: explicit, facultyId }, select: { id: true } });
    if (!course) throw new AppError("courseId does not belong to you", 422);
    return course.id;
  }
  const courses = await prisma.course.findMany({ where: { facultyId }, select: { id: true, courseCode: true } });
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const target = norm(label);
  const hit = courses.find((c) => target.startsWith(norm(c.courseCode)) || target.includes(norm(c.courseCode)));
  return hit?.id ?? null;
}

async function regenerate(termId: number) {
  const [term, slots, events] = await Promise.all([
    prisma.term.findUniqueOrThrow({ where: { id: termId } }),
    prisma.classSlot.findMany({ where: { termId } }),
    prisma.calendarEvent.findMany({ where: { termId } }),
  ]);
  // A term stored before the span caps existed can still hold an impossible range.
  // The backstop in eachDate keeps that from exhausting the heap; translating it
  // here turns an opaque 500 into something the faculty can act on, and editing the
  // term's dates repairs it.
  let generated;
  try {
    generated = generateSessions(term, slots, events);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new AppError(
        `This term spans ${Math.round(spanDays(term.startDate, term.endDate))} days, which is beyond the ${MAX_TERM_DAYS}-day limit. Edit the term's start and end dates to continue.`,
        422,
        { startDate: term.startDate, endDate: term.endDate }
      );
    }
    throw error;
  }
  // Keep every session the faculty has touched (cancelled/held/rescheduled/logged/manual); recreate only untouched generated ones.
  await prisma.$transaction(async (tx) => {
    const touched = await tx.classSession.findMany({
      where: { termId, OR: [{ slotId: null }, { status: { notIn: ["SCHEDULED", "HOLIDAY"] } }, { loggedAt: { not: null } }, { plannedTopics: { not: Prisma.DbNull } }] },
      select: { id: true, slotId: true, date: true },
    });
    const keep = new Set(touched.map((s) => `${s.slotId}|${s.date}`));
    // Untouched generated rows (including ones orphaned by a deleted slot) are rebuilt from scratch.
    await tx.classSession.deleteMany({ where: { termId, rescheduledFromId: null, status: { in: ["SCHEDULED", "HOLIDAY"] }, loggedAt: null, plannedTopics: { equals: Prisma.DbNull } } });
    const rows = generated.filter((g) => !keep.has(`${g.slotId}|${g.date}`)).map((g) => ({ termId, ...g }));
    for (let i = 0; i < rows.length; i += 500) await tx.classSession.createMany({ data: rows.slice(i, i + 500) });
  });
  return prisma.classSession.count({ where: { termId } });
}

export const scheduleService = {
  // ---- Terms ----
  async listTerms(facultyId: number) {
    return prisma.term.findMany({ where: { facultyId }, orderBy: [{ isActive: "desc" }, { startDate: "desc" }], include: { _count: { select: { slots: true, sessions: true, events: true } } } });
  },

  async createTerm(facultyId: number, input: z.infer<typeof termSchema>) {
    return prisma.$transaction(async (tx) => {
      await tx.term.updateMany({ where: { facultyId, isActive: true }, data: { isActive: false } });
      return tx.term.create({ data: { facultyId, ...input, isActive: true } });
    });
  },

  async updateTerm(facultyId: number, termId: number, input: z.infer<typeof termUpdateSchema>) {
    const current = await ownedTerm(facultyId, termId);
    const startDate = input.startDate ?? current.startDate;
    const endDate = input.endDate ?? current.endDate;
    if (endDate <= startDate) throw new AppError("endDate must be after startDate", 422);
    // Authoritative span check: the schema can only see the fields the PATCH sent,
    // so a one-sided update is caught here against the stored term. Must run before
    // the write below — the row is committed before `regenerate`, so a span that
    // fails during generation would otherwise persist and break the term for good.
    if (spanDays(startDate, endDate) > MAX_TERM_DAYS) {
      throw new AppError(`A term cannot exceed ${MAX_TERM_DAYS} days`, 422);
    }
    if (input.isActive) await prisma.term.updateMany({ where: { facultyId, isActive: true, id: { not: termId } }, data: { isActive: false } });
    const term = await prisma.term.update({ where: { id: termId }, data: input });
    if (input.startDate || input.endDate) await regenerate(termId);
    return term;
  },

  async deleteTerm(facultyId: number, termId: number) {
    await ownedTerm(facultyId, termId);
    await prisma.term.delete({ where: { id: termId } });
    return { id: termId };
  },

  async activeTerm(facultyId: number) {
    return prisma.term.findFirst({ where: { facultyId, isActive: true } }) ?? prisma.term.findFirst({ where: { facultyId }, orderBy: { startDate: "desc" } });
  },

  // ---- Slots ----
  async listSlots(facultyId: number, termId: number) {
    await ownedTerm(facultyId, termId);
    return prisma.classSlot.findMany({ where: { termId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], include: { course: { select: { id: true, courseCode: true, courseName: true } } } });
  },

  async saveSlots(facultyId: number, termId: number, input: z.infer<typeof slotsBulkSchema>) {
    await ownedTerm(facultyId, termId);
    const rows: Prisma.ClassSlotCreateManyInput[] = [];
    for (const slot of input.slots) {
      rows.push({ termId, ...slot, section: slot.section ?? null, room: slot.room ?? null, courseId: await matchCourseId(facultyId, slot.courseLabel, slot.courseId) });
    }
    // Overlap check across the submitted set plus (unless replacing) the slots already stored.
    const existing = input.replace ? [] : await prisma.classSlot.findMany({ where: { termId } });
    const all = [...rows, ...existing];
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = rows[i];
        const b = all[j];
        if (a.dayOfWeek === b.dayOfWeek && toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
          throw new AppError(`Slots overlap on ${DAY_NAMES[a.dayOfWeek]}: ${a.courseLabel} ${a.startTime}–${a.endTime} and ${b.courseLabel} ${b.startTime}–${b.endTime}`, 422);
        }
      }
    }
    await prisma.$transaction(async (tx) => {
      if (input.replace) await tx.classSlot.deleteMany({ where: { termId } });
      await tx.classSlot.createMany({ data: rows });
    });
    const sessions = await regenerate(termId);
    await auditService.recordAuditLog({ userId: facultyId, action: "Faculty saved timetable slots", document: `term:${termId}` });
    return { slots: await this.listSlots(facultyId, termId), sessions };
  },

  async deleteSlot(facultyId: number, termId: number, slotId: number) {
    await ownedTerm(facultyId, termId);
    const result = await prisma.classSlot.deleteMany({ where: { id: slotId, termId } });
    if (!result.count) throw new AppError("Slot not found", 404);
    return { id: slotId, sessions: await regenerate(termId) };
  },

  // ---- Calendar events ----
  async listEvents(facultyId: number, termId: number) {
    await ownedTerm(facultyId, termId);
    return prisma.calendarEvent.findMany({ where: { termId }, orderBy: [{ date: "asc" }, { startTime: "asc" }], include: { course: { select: { id: true, courseCode: true } } } });
  },

  async addEvents(facultyId: number, termId: number, input: z.infer<typeof eventsBulkSchema>) {
    const term = await ownedTerm(facultyId, termId);
    // Containment cannot live in the schema (no term in scope there). Rejecting is
    // also the correct product behaviour: an event outside the term never affects
    // generation, so silently storing one only invites confusion later.
    for (const event of input.events) {
      const end = event.endDate ?? event.date;
      if (event.date < term.startDate || end > term.endDate) {
        throw new AppError(`Event "${event.title}" falls outside ${term.startDate} to ${term.endDate}`, 422);
      }
      if (event.courseId) {
        const owned = await prisma.course.findFirst({ where: { id: event.courseId, facultyId }, select: { id: true } });
        if (!owned) throw new AppError("courseId does not belong to you", 422);
      }
    }
    await prisma.calendarEvent.createMany({
      data: input.events.map((e) => ({ termId, ...e, endDate: e.endDate ?? null, courseId: e.courseId ?? null, section: e.section ?? null, startTime: e.startTime ?? null, endTime: e.endTime ?? null })),
    });
    const sessions = await regenerate(termId);
    const clashes = await this.clashes(facultyId, termId);
    return { events: await this.listEvents(facultyId, termId), sessions, clashes };
  },

  async deleteEvent(facultyId: number, termId: number, eventId: number) {
    await ownedTerm(facultyId, termId);
    const result = await prisma.calendarEvent.deleteMany({ where: { id: eventId, termId } });
    if (!result.count) throw new AppError("Event not found", 404);
    return { id: eventId, sessions: await regenerate(termId) };
  },

  /** Assessment sanity checks across the term (see clashes.ts for the rules). */
  async clashes(facultyId: number, termId: number) {
    await ownedTerm(facultyId, termId);
    const [events, sessions] = await Promise.all([
      prisma.calendarEvent.findMany({ where: { termId }, include: { course: { select: { courseCode: true } } } }),
      prisma.classSession.findMany({ where: { termId }, select: { id: true, date: true, startTime: true, endTime: true, status: true, courseId: true, courseLabel: true, section: true, plannedTopics: true, coveredTopics: true } }),
    ]);
    return detectClashes(
      events.map((e) => ({ ...e, courseLabel: e.course?.courseCode ?? null })),
      sessions.map((s) => ({ ...s, plannedTopics: (s.plannedTopics as string[] | null) ?? null, coveredTopics: (s.coveredTopics as string[] | null) ?? null }))
    );
  },

  async workload(facultyId: number, termId: number) {
    const term = await ownedTerm(facultyId, termId);
    const sessions = await prisma.classSession.findMany({ where: { termId }, select: { date: true, startTime: true, endTime: true, status: true, courseLabel: true, section: true, kind: true } });
    return { termId, termName: term.name, ...computeWorkload(term, sessions) };
  },

  // ---- Public calendar feed ----
  async feedUrl(facultyId: number, termId: number, rotate = false) {
    const term = await ownedTerm(facultyId, termId);
    let token = term.feedToken;
    if (!token || rotate) {
      token = randomBytes(24).toString("hex");
      await prisma.term.update({ where: { id: termId }, data: { feedToken: token } });
      if (rotate) await auditService.recordAuditLog({ userId: facultyId, action: "Faculty rotated calendar feed link", document: `term:${termId}` });
    }
    return { termId, url: `${env.apiPublicUrl}/api/schedule/feed/${token}.ics`, rotated: rotate };
  },

  async revokeFeed(facultyId: number, termId: number) {
    await ownedTerm(facultyId, termId);
    await prisma.term.update({ where: { id: termId }, data: { feedToken: null } });
    return { termId, revoked: true };
  },

  async icsByToken(token: string) {
    if (!/^[a-f0-9]{48}$/.test(token)) throw new AppError("Calendar not found", 404);
    const term = await prisma.term.findUnique({ where: { feedToken: token }, select: { id: true, facultyId: true } });
    if (!term) throw new AppError("Calendar not found", 404);
    return this.ics(term.facultyId, term.id);
  },

  freeRooms(query: Parameters<typeof departmentRoutineService.freeRooms>[0]) {
    return departmentRoutineService.freeRooms(query);
  },

  // ---- Sessions ----
  async listSessions(facultyId: number, termId: number, query: z.infer<typeof rangeQuerySchema>) {
    const term = await ownedTerm(facultyId, termId);
    return prisma.classSession.findMany({
      where: { termId, date: { gte: query.from ?? term.startDate, lte: query.to ?? term.endDate }, ...(query.courseId ? { courseId: query.courseId } : {}) },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { course: { select: { id: true, courseCode: true, courseName: true } } },
    });
  },

  async createSession(facultyId: number, termId: number, input: z.infer<typeof sessionCreateSchema>) {
    const term = await ownedTerm(facultyId, termId);
    if (input.date < term.startDate || input.date > term.endDate) throw new AppError("Date is outside the term", 422);
    const clash = await prisma.classSession.findFirst({
      where: { termId, date: input.date, status: { in: ["SCHEDULED", "MAKEUP", "HELD"] }, startTime: { lt: input.endTime }, endTime: { gt: input.startTime } },
    });
    if (clash) throw new AppError(`Clashes with ${clash.courseLabel} ${clash.startTime}–${clash.endTime}`, 422);
    return prisma.classSession.create({
      data: {
        termId,
        ...input,
        section: input.section ?? null,
        room: input.room ?? null,
        courseId: await matchCourseId(facultyId, input.courseLabel, input.courseId),
        plannedTopics: input.plannedTopics ?? Prisma.DbNull,
        status: "MAKEUP",
      },
    });
  },

  async updateSession(facultyId: number, sessionId: number, input: z.infer<typeof sessionUpdateSchema>) {
    const session = await ownedSession(facultyId, sessionId);
    const startTime = input.startTime ?? session.startTime;
    const endTime = input.endTime ?? session.endTime;
    if (toMinutes(endTime) <= toMinutes(startTime)) throw new AppError("endTime must be after startTime", 422);
    return prisma.classSession.update({ where: { id: sessionId }, data: { ...input, plannedTopics: input.plannedTopics === undefined ? undefined : input.plannedTopics } });
  },

  async deleteSession(facultyId: number, sessionId: number) {
    const session = await ownedSession(facultyId, sessionId);
    if (session.slotId && session.status === "SCHEDULED") throw new AppError("Generated sessions cannot be deleted — cancel them instead, or remove the slot", 422);
    await prisma.classSession.delete({ where: { id: sessionId } });
    return { id: sessionId };
  },

  async cancelSession(facultyId: number, sessionId: number, input: z.infer<typeof cancelSchema>) {
    const session = await ownedSession(facultyId, sessionId);
    if (!["SCHEDULED", "MAKEUP"].includes(session.status)) throw new AppError(`Cannot cancel a ${session.status.toLowerCase()} session`, 422);
    const updated = await prisma.classSession.update({ where: { id: sessionId }, data: { status: "CANCELLED", reason: input.reason ?? null } });
    await auditService.recordAuditLog({ userId: facultyId, action: "Faculty cancelled class", document: `session:${sessionId}` });
    return updated;
  },

  async restoreSession(facultyId: number, sessionId: number) {
    const session = await ownedSession(facultyId, sessionId);
    if (session.status !== "CANCELLED") throw new AppError("Only cancelled sessions can be restored", 422);
    const makeup = await prisma.classSession.findFirst({ where: { rescheduledFromId: sessionId } });
    if (makeup) throw new AppError("Delete the make-up class first", 422);
    return prisma.classSession.update({ where: { id: sessionId }, data: { status: "SCHEDULED", reason: null } });
  },

  /** Deterministic suggestions; the faculty picks one (or types their own) — the AI never writes the calendar. */
  async suggestReschedule(facultyId: number, sessionId: number) {
    const session = await ownedSession(facultyId, sessionId);
    const term = session.term;
    const from = session.date > todayIso() ? session.date : todayIso();
    const to = addDays(from, 21) <= term.endDate ? addDays(from, 21) : term.endDate;
    const [existing, events, hooks] = await Promise.all([
      prisma.classSession.findMany({ where: { termId: term.id, date: { gte: from, lte: to } }, select: { id: true, date: true, startTime: true, endTime: true, status: true, section: true, courseLabel: true, room: true } }),
      prisma.calendarEvent.findMany({ where: { termId: term.id } }),
      departmentRoutineService.availabilityHooks(),
    ]);
    const suggestions = findFreeSlots(session, existing.filter((e) => e.id !== session.id), events, { from, to, limit: 6, hooks: hooks ?? undefined });
    return { sessionId, window: { from, to }, suggestions, roomAware: Boolean(hooks) };
  },

  async rescheduleSession(facultyId: number, sessionId: number, input: z.infer<typeof rescheduleSchema>) {
    const session = await ownedSession(facultyId, sessionId);
    if (!["SCHEDULED", "CANCELLED", "HOLIDAY", "MAKEUP"].includes(session.status)) throw new AppError(`Cannot reschedule a ${session.status.toLowerCase()} session`, 422);
    if (input.date < session.term.startDate || input.date > session.term.endDate) throw new AppError("New date is outside the term", 422);
    const existingMakeup = await prisma.classSession.findFirst({ where: { rescheduledFromId: sessionId } });
    if (existingMakeup) throw new AppError("This session already has a make-up class", 422);
    const clash = await prisma.classSession.findFirst({
      where: { termId: session.termId, id: { not: sessionId }, date: input.date, status: { in: ["SCHEDULED", "MAKEUP", "HELD"] }, startTime: { lt: input.endTime }, endTime: { gt: input.startTime } },
    });
    if (clash) throw new AppError(`Clashes with ${clash.courseLabel} on ${input.date} ${clash.startTime}–${clash.endTime}`, 422);

    const [original, makeup] = await prisma.$transaction([
      prisma.classSession.update({ where: { id: sessionId }, data: { status: "RESCHEDULED", reason: input.reason ?? session.reason } }),
      prisma.classSession.create({
        data: {
          termId: session.termId,
          slotId: null,
          courseId: session.courseId,
          courseLabel: session.courseLabel,
          section: session.section,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          room: input.room === undefined ? session.room : input.room,
          kind: session.kind,
          status: "MAKEUP",
          rescheduledFromId: sessionId,
          plannedWeek: session.plannedWeek,
          plannedTopics: session.plannedTopics ?? Prisma.DbNull,
        },
      }),
    ]);
    await auditService.recordAuditLog({ userId: facultyId, action: "Faculty rescheduled class", document: `session:${sessionId}` });
    return { original, makeup };
  },

  async logSession(facultyId: number, sessionId: number, input: z.infer<typeof logSchema>) {
    const session = await ownedSession(facultyId, sessionId);
    if (["CANCELLED", "HOLIDAY", "RESCHEDULED"].includes(session.status)) throw new AppError("This class did not take place", 422);
    return prisma.classSession.update({
      where: { id: sessionId },
      data: { status: "HELD", coveredTopics: input.coveredTopics, notes: input.notes ?? null, materialIds: input.materialIds ?? Prisma.DbNull, loggedAt: new Date() },
    });
  },

  // ---- Derived views ----
  async makeupDebt(facultyId: number, termId: number) {
    await ownedTerm(facultyId, termId);
    const lost = await prisma.classSession.findMany({
      where: { termId, status: { in: ["CANCELLED", "HOLIDAY"] }, rescheduledTo: null },
      orderBy: { date: "asc" },
      select: { id: true, courseId: true, courseLabel: true, section: true, date: true, startTime: true, endTime: true, status: true, reason: true },
    });
    const byCourse = new Map<string, { courseId: number | null; courseLabel: string; owed: typeof lost }>();
    for (const s of lost) {
      const key = `${s.courseLabel}|${s.section ?? ""}`;
      const entry = byCourse.get(key) ?? { courseId: s.courseId, courseLabel: `${s.courseLabel}${s.section ? ` (${s.section})` : ""}`, owed: [] };
      entry.owed.push(s);
      byCourse.set(key, entry);
    }
    return { total: lost.length, courses: [...byCourse.values()].sort((a, b) => b.owed.length - a.owed.length) };
  },

  async today(facultyId: number, date = todayIso()) {
    const term = await this.activeTerm(facultyId);
    if (!term) return { term: null, date, sessions: [], upcoming: [] };
    const [sessions, upcoming, debt] = await Promise.all([
      prisma.classSession.findMany({ where: { termId: term.id, date }, orderBy: { startTime: "asc" }, include: { course: { select: { id: true, courseCode: true, courseName: true } } } }),
      prisma.classSession.findMany({ where: { termId: term.id, date: { gt: date, lte: addDays(date, 7) }, status: { in: ["SCHEDULED", "MAKEUP"] } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 8 }),
      this.makeupDebt(facultyId, term.id),
    ]);
    // Attach last log of the same course so the briefing says "last time you covered…".
    const withLast = await Promise.all(
      sessions.map(async (s) => {
        const last = s.courseId
          ? await prisma.classSession.findFirst({ where: { courseId: s.courseId, status: "HELD", date: { lt: date } }, orderBy: { date: "desc" }, select: { date: true, coveredTopics: true, notes: true } })
          : null;
        return { ...s, lastLog: last };
      })
    );
    return { term, date, sessions: withLast, upcoming, makeupDebt: debt.total };
  },

  /** Planned (lecture plan weeks) vs covered (session logs) for one course in the active term. */
  async pace(facultyId: number, courseId: number) {
    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId }, select: { id: true, courseCode: true } });
    if (!course) throw new AppError("Course not found", 404);
    const term = await this.activeTerm(facultyId);
    const plan = await prisma.lecturePlan.findFirst({ where: { courseId }, orderBy: { createdAt: "desc" } });
    const planWeeks = ((plan?.planJson as { weeks?: Array<{ week: number; title: string; topics: string[] }> } | null)?.weeks ?? []).slice().sort((a, b) => a.week - b.week);
    const plannedTopics = planWeeks.flatMap((w) => w.topics);
    if (!term) return { courseId, term: null, planId: plan?.id ?? null, plannedTopics, coveredTopics: [], remainingTopics: plannedTopics, sessions: { total: 0, held: 0, remaining: 0, lost: 0 }, expectedCoveredByNow: 0, deltaTopics: 0, status: "NO_TERM" as const, note: "Create a term to track pace." };

    const sessions = await prisma.classSession.findMany({ where: { termId: term.id, courseId, kind: { in: ["LECTURE", "LAB", "TUTORIAL", "OTHER"] } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
    const today = todayIso();
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const covered = new Set<string>();
    for (const s of sessions) for (const t of (s.coveredTopics as string[] | null) ?? []) covered.add(norm(t));
    const coveredTopics = plannedTopics.filter((t) => covered.has(norm(t)));
    const remainingTopics = plannedTopics.filter((t) => !covered.has(norm(t)));
    const teaching = sessions.filter((s) => ["SCHEDULED", "MAKEUP", "HELD"].includes(s.status));
    const held = sessions.filter((s) => s.status === "HELD").length;
    const past = teaching.filter((s) => s.date < today).length;
    const remaining = teaching.filter((s) => s.date >= today).length;
    const lost = sessions.filter((s) => ["CANCELLED", "HOLIDAY"].includes(s.status) && !sessions.some((m) => m.rescheduledFromId === s.id)).length;
    const perSession = teaching.length ? plannedTopics.length / teaching.length : 0;
    const expectedCoveredByNow = Math.round(perSession * past);
    const deltaTopics = coveredTopics.length - expectedCoveredByNow;
    const canFinish = remaining > 0 ? remainingTopics.length / remaining : remainingTopics.length ? Infinity : 0;
    const status: "AHEAD" | "ON_TRACK" | "BEHIND" | "AT_RISK" | "NO_PLAN" = !plannedTopics.length ? "NO_PLAN" : canFinish > perSession * 1.6 ? "AT_RISK" : deltaTopics < -Math.max(2, perSession * 2) ? "BEHIND" : deltaTopics > perSession * 2 ? "AHEAD" : "ON_TRACK";
    return {
      courseId,
      term: { id: term.id, name: term.name },
      planId: plan?.id ?? null,
      plannedTopics,
      coveredTopics,
      remainingTopics,
      sessions: { total: teaching.length, held, past, remaining, lost },
      expectedCoveredByNow,
      deltaTopics,
      topicsPerRemainingSession: remaining ? Math.round((remainingTopics.length / remaining) * 10) / 10 : null,
      status,
      note:
        status === "NO_PLAN"
          ? "Generate a lecture plan for this course to track pace against it."
          : status === "AT_RISK"
            ? `${remainingTopics.length} topics left for ${remaining} sessions — the plan will not finish without compressing or dropping topics.`
            : `${coveredTopics.length}/${plannedTopics.length} planned topics logged as covered; ${held} classes logged, ${lost} lost without make-up.`,
    };
  },

  replan(facultyId: number, input: z.infer<typeof replanSchema>) {
    return tracedAnalysis(async () => {
      const pace = await this.pace(facultyId, input.courseId);
      if (!pace.term) throw new AppError("Create a term first", 400);
      if (!pace.plannedTopics.length) throw new AppError("Generate a lecture plan first", 400);
      const today = todayIso();
      const [remainingSessions, events, course] = await Promise.all([
        prisma.classSession.findMany({ where: { termId: pace.term.id, courseId: input.courseId, date: { gte: today }, status: { in: ["SCHEDULED", "MAKEUP"] } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
        prisma.calendarEvent.findMany({ where: { termId: pace.term.id, kind: { in: ["EXAM_WEEK", "DEADLINE"] } } }),
        prisma.course.findUniqueOrThrow({ where: { id: input.courseId }, select: { courseCode: true } }),
      ]);
      if (!remainingSessions.length) throw new AppError("No remaining scheduled sessions for this course", 422);
      const { consensus } = await runLlmAnalysis(
        PACE_REPLAN_PROMPT,
        [
          {
            courseLabel: course.courseCode,
            remainingTopics: pace.remainingTopics,
            coveredTopics: pace.coveredTopics,
            remainingSessions: remainingSessions.map((s) => ({ sessionId: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, kind: s.kind })),
            assessments: events.map((e) => ({ date: e.date, title: e.title })),
            facultyNote: input.note,
          },
        ],
        paceReplanResponseSchema
      );
      const valid = new Set(remainingSessions.map((s) => s.id));
      const assignments = consensus.sessions.filter((s) => valid.has(s.sessionId));
      if (input.apply) {
        await prisma.$transaction(assignments.map((a) => prisma.classSession.update({ where: { id: a.sessionId }, data: { plannedTopics: a.topics } })));
        await auditService.recordAuditLog({ userId: facultyId, action: "Faculty applied AI re-plan", document: `course:${input.courseId}` });
      }
      return { ...consensus, sessions: assignments, applied: input.apply, remainingSessions: remainingSessions.length };
    });
  },

  noticeDraft(facultyId: number, sessionId: number, input: z.infer<typeof noticeSchema>) {
    return tracedAnalysis(async () => {
      const session = await ownedSession(facultyId, sessionId);
      const [makeup, teacher] = await Promise.all([
        prisma.classSession.findFirst({ where: { rescheduledFromId: sessionId } }),
        prisma.user.findUniqueOrThrow({ where: { id: facultyId }, select: { name: true } }),
      ]);
      const action = makeup ? "RESCHEDULE" : session.status === "CANCELLED" || session.status === "HOLIDAY" ? "CANCEL" : "ROOM_CHANGE";
      const { consensus } = await runLlmAnalysis(
        CLASS_NOTICE_PROMPT,
        [
          {
            channel: input.channel,
            action,
            courseLabel: session.courseLabel,
            section: session.section,
            original: { date: session.date, startTime: session.startTime, endTime: session.endTime, room: session.room },
            replacement: makeup ? { date: makeup.date, startTime: makeup.startTime, endTime: makeup.endTime, room: makeup.room } : null,
            reason: session.reason,
            plannedTopics: (session.plannedTopics as string[] | null) ?? undefined,
            teacherName: teacher.name,
          },
        ],
        classNoticeResponseSchema,
        { temperature: 0.4 }
      );
      return consensus;
    });
  },

  async ics(facultyId: number, termId: number) {
    const term = await ownedTerm(facultyId, termId);
    const [sessions, assessments] = await Promise.all([
      prisma.classSession.findMany({ where: { termId, status: { in: ["SCHEDULED", "MAKEUP", "HELD", "CANCELLED"] } }, orderBy: { date: "asc" } }),
      prisma.calendarEvent.findMany({ where: { termId, kind: "ASSESSMENT" }, include: { course: { select: { courseCode: true } } } }),
    ]);
    const content = buildIcs(`AcadIQ · ${term.name}`, [
      ...sessions.map((s) => ({
        uid: `acadiq-session-${s.id}@acadiq`,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        summary: `${s.status === "CANCELLED" ? "[CANCELLED] " : s.status === "MAKEUP" ? "[MAKE-UP] " : ""}${s.courseLabel}${s.section ? ` (${s.section})` : ""}${s.kind !== "LECTURE" ? ` · ${s.kind.toLowerCase()}` : ""}`,
        description: [(s.plannedTopics as string[] | null)?.length ? `Planned: ${(s.plannedTopics as string[]).join(", ")}` : null, s.reason ? `Note: ${s.reason}` : null].filter(Boolean).join("\n") || undefined,
        location: s.room,
        status: (s.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED") as "CANCELLED" | "CONFIRMED",
      })),
      ...assessments.map((a) => ({
        uid: `acadiq-assessment-${a.id}@acadiq`,
        date: a.date,
        startTime: a.startTime ?? "09:00",
        endTime: a.endTime ?? "10:00",
        summary: `[ASSESSMENT] ${a.title}${a.course ? ` · ${a.course.courseCode}` : ""}${a.section ? ` (${a.section})` : ""}`,
        location: null,
        status: "CONFIRMED" as const,
      })),
    ]);
    return { filename: `${term.name.replace(/[^\w-]+/g, "_")}.ics`, content };
  },
};
