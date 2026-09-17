import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const bloomLevel = z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]);

export const rubricGenerationResponseSchema = z.object({
  questions: z
    .array(
      z.object({
        questionId: z.number().int(),
        modelAnswer: nonEmpty,
        markingPoints: z.array(z.object({ point: nonEmpty, marks: z.number().min(0) })).min(1).max(20),
        partialCreditRules: z.array(z.string().trim()).max(10).default([]),
        commonErrors: z.array(z.string().trim()).max(10).default([]),
      })
    )
    .min(1),
  generalGuidance: z.array(z.string().trim()).max(15).default([]),
});
export type RubricGenerationResponse = z.infer<typeof rubricGenerationResponseSchema>;

export const questionRewriteResponseSchema = z.object({
  variants: z
    .array(
      z.object({
        text: nonEmpty.max(4000),
        bloomLevel,
        marks: z.number().min(0),
        rationale: nonEmpty.max(600),
      })
    )
    .min(1)
    .max(4),
});
export type QuestionRewriteResponse = z.infer<typeof questionRewriteResponseSchema>;

export const lecturePlanResponseSchema = z.object({
  title: nonEmpty.max(200),
  weeks: z
    .array(
      z.object({
        week: z.number().int().min(1),
        title: nonEmpty.max(200),
        topics: z.array(z.string().trim()).min(1).max(12),
        outcomes: z.array(z.string().trim()).max(12).default([]),
        activities: z.array(z.string().trim()).max(8).default([]),
        assessment: z.string().trim().nullable().default(null),
        materialsHint: z.string().trim().nullable().default(null),
      })
    )
    .min(1)
    .max(30),
  assumptions: z.array(z.string().trim()).max(10).default([]),
});
export type LecturePlanResponse = z.infer<typeof lecturePlanResponseSchema>;

/* ---------------------------------- Timetable ---------------------------------- */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM expected");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const routineExtractResponseSchema = z.object({
  slots: z
    .array(
      z.object({
        courseLabel: nonEmpty.max(120),
        section: z.string().trim().max(40).nullable(),
        teacher: z.string().trim().max(80).nullable().optional(),
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: hhmm,
        endTime: hhmm,
        room: z.string().trim().max(60).nullable(),
        kind: z.enum(["LECTURE", "LAB", "TUTORIAL", "OFFICE_HOUR", "OTHER"]),
        confidence: z.number().min(0).max(100),
      })
    )
    .max(400),
  termHint: z.object({ name: z.string().nullable(), startDate: isoDate.nullable(), endDate: isoDate.nullable() }).optional(),
  warnings: z.array(z.string()).max(20).optional(),
});
export type RoutineExtractResponse = z.infer<typeof routineExtractResponseSchema>;

export const classNoticeResponseSchema = z.object({
  channel: z.enum(["EMAIL", "CHAT"]),
  subject: z.string().nullable(),
  body: nonEmpty.max(2000),
});

export const paceReplanResponseSchema = z.object({
  sessions: z.array(z.object({ sessionId: z.number().int(), date: z.string(), topics: z.array(z.string()).max(12), note: z.string().nullable() })).max(120),
  dropped: z.array(z.string()).max(40),
  compressed: z.array(z.string()).max(40),
  summary: nonEmpty.max(1000),
});
export type PaceReplanResponse = z.infer<typeof paceReplanResponseSchema>;

export const assistantPlannerResponseSchema = z.object({
  reply: nonEmpty.max(1500),
  actions: z.array(z.object({ tool: nonEmpty.max(60), args: z.record(z.unknown()).default({}), why: z.string().max(300).default("") })).max(8).default([]),
  needsConfirmation: z.boolean().default(false),
  followUpQuestion: z.string().max(300).nullable().default(null),
  navigate: z.string().max(120).nullable().default(null),
});
export type AssistantPlannerResponse = z.infer<typeof assistantPlannerResponseSchema>;
