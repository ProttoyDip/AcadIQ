import { promises as fs } from "node:fs";
import { z } from "zod";
import { prisma } from "../../database/prismaClient";
import { AppError } from "../../middleware/error.middleware";
import { runLlmAnalysis } from "../../ai/runner";
import { ROUTINE_EXTRACT_PROMPT } from "../../ai/prompts/timetable.prompt";
import { routineExtractResponseSchema } from "../../ai/schemas/facultyWorkflows.schema";
import { tracedAnalysis } from "../traced";
import { auditService } from "../audit.service";
import { env } from "../../config/env";
import { dayOfWeek, overlaps, toMinutes } from "./dates";
import { routineFileToText } from "./routineSource";

const MAX_CHARS = Math.min(env.syllabusPromptChars * 2, 60_000);

export const departmentImportSchema = z.object({
  termLabel: z.string().trim().min(2).max(80),
  replace: z.coerce.boolean().default(true),
});

export const freeRoomsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/**
 * Department-wide routine (uploaded by an admin). Read side is shared by every faculty:
 * which rooms are free at a time, and whether a section is already in class.
 */
export const departmentRoutineService = {
  import(adminId: number, file: { path: string; mimetype: string; originalname: string }, input: z.infer<typeof departmentImportSchema>, options: { keepFile?: boolean } = {}) {
    return tracedAnalysis(async () => {
      let text: string;
      try {
        ({ text } = await routineFileToText(file));
      } finally {
        if (!options.keepFile) await fs.unlink(file.path).catch(() => undefined);
      }
      if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n[Routine truncated to ${MAX_CHARS} characters]`;
      const courses = await prisma.course.findMany({ select: { courseCode: true, courseName: true }, distinct: ["courseCode"] });
      const { consensus } = await runLlmAnalysis(
        ROUTINE_EXTRACT_PROMPT,
        [{ text, scope: "DEPARTMENT", knownCourses: courses.map((c) => ({ code: c.courseCode, name: c.courseName })) }],
        routineExtractResponseSchema,
        { cache: false }
      );
      const slots = consensus.slots.filter((s) => toMinutes(s.endTime) > toMinutes(s.startTime));
      if (!slots.length) throw new AppError(`No class rows were found in ${file.originalname}`, 422);

      const routine = await prisma.$transaction(async (tx) => {
        if (input.replace) await tx.departmentRoutine.deleteMany({});
        const created = await tx.departmentRoutine.create({ data: { uploadedById: adminId, termLabel: input.termLabel, originalName: file.originalname, slotCount: slots.length } });
        await tx.departmentSlot.createMany({
          data: slots.map((s) => ({ routineId: created.id, courseLabel: s.courseLabel, section: s.section, teacher: s.teacher ?? null, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, room: s.room, kind: s.kind })),
        });
        return created;
      });
      await auditService.recordAuditLog({ userId: adminId, action: "Admin imported department routine", document: `department-routine:${routine.id}` });
      return { ...routine, warnings: consensus.warnings ?? [], rooms: [...new Set(slots.map((s) => s.room).filter(Boolean))].length, teachers: [...new Set(slots.map((s) => s.teacher).filter(Boolean))].length };
    });
  },

  list() {
    return prisma.departmentRoutine.findMany({ orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } });
  },

  async slots(routineId: number) {
    const routine = await prisma.departmentRoutine.findUnique({ where: { id: routineId } });
    if (!routine) throw new AppError("Routine not found", 404);
    return prisma.departmentSlot.findMany({ where: { routineId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { room: "asc" }] });
  },

  async remove(routineId: number) {
    const result = await prisma.departmentRoutine.deleteMany({ where: { id: routineId } });
    if (!result.count) throw new AppError("Routine not found", 404);
    return { id: routineId };
  },

  async hasData() {
    return (await prisma.departmentSlot.count()) > 0;
  },

  /** Rooms that no department slot and no faculty session occupies in the window. */
  async freeRooms(query: z.infer<typeof freeRoomsQuerySchema>) {
    if (toMinutes(query.endTime) <= toMinutes(query.startTime)) throw new AppError("endTime must be after startTime", 422);
    const dow = dayOfWeek(query.date);
    const [allRooms, deptBusy, sessionBusy] = await Promise.all([
      prisma.departmentSlot.findMany({ where: { room: { not: null } }, select: { room: true }, distinct: ["room"] }),
      prisma.departmentSlot.findMany({ where: { dayOfWeek: dow, room: { not: null } }, select: { room: true, startTime: true, endTime: true, courseLabel: true, teacher: true } }),
      prisma.classSession.findMany({ where: { date: query.date, status: { in: ["SCHEDULED", "MAKEUP", "HELD"] }, room: { not: null } }, select: { room: true, startTime: true, endTime: true, courseLabel: true } }),
    ]);
    const busy = new Map<string, string>();
    for (const s of deptBusy) if (overlaps(query.startTime, query.endTime, s.startTime, s.endTime)) busy.set(norm(s.room), `${s.courseLabel}${s.teacher ? ` (${s.teacher})` : ""}`);
    for (const s of sessionBusy) if (overlaps(query.startTime, query.endTime, s.startTime, s.endTime)) busy.set(norm(s.room), s.courseLabel);
    const rooms = [...new Set(allRooms.map((r) => r.room!))].sort();
    return {
      ...query,
      free: rooms.filter((r) => !busy.has(norm(r))),
      busy: rooms.filter((r) => busy.has(norm(r))).map((room) => ({ room, occupiedBy: busy.get(norm(room))! })),
      source: rooms.length ? "DEPARTMENT_ROUTINE" : "NONE",
    };
  },

  /** Callbacks for the make-up finder: which rooms are taken and whether a section is in another class. */
  async availabilityHooks() {
    const slots = await prisma.departmentSlot.findMany({ select: { dayOfWeek: true, startTime: true, endTime: true, room: true, section: true, courseLabel: true } });
    if (!slots.length) return null;
    return {
      roomBusy: (date: string, startTime: string, endTime: string, room: string | null) =>
        room ? slots.some((s) => s.dayOfWeek === dayOfWeek(date) && norm(s.room) === norm(room) && overlaps(startTime, endTime, s.startTime, s.endTime)) : false,
      sectionBusy: (date: string, startTime: string, endTime: string, section: string | null, courseLabel: string) =>
        section
          ? slots.some((s) => s.dayOfWeek === dayOfWeek(date) && norm(s.section) === norm(section) && norm(s.courseLabel) !== norm(courseLabel) && overlaps(startTime, endTime, s.startTime, s.endTime))
          : false,
      freeRoomAt: (date: string, startTime: string, endTime: string) => {
        const rooms = [...new Set(slots.map((s) => s.room).filter((r): r is string => Boolean(r)))];
        return rooms.find((r) => !slots.some((s) => s.dayOfWeek === dayOfWeek(date) && norm(s.room) === norm(r) && overlaps(startTime, endTime, s.startTime, s.endTime))) ?? null;
      },
    };
  },
};
