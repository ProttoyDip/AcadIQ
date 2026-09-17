import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { runLlmAnalysis } from "../ai/runner";
import { LECTURE_PLAN_PROMPT } from "../ai/prompts/facultyWorkflows.prompt";
import { lecturePlanResponseSchema } from "../ai/schemas/facultyWorkflows.schema";
import { courseRepository } from "../repositories/course.repository";
import { loadSyllabusText } from "./analysisContext.service";
import { tracedAnalysis } from "./traced";
import { auditService } from "./audit.service";

export const lecturePlanSchema = z.object({
  weeks: z.coerce.number().int().min(4).max(30).default(14),
  hoursPerWeek: z.coerce.number().int().min(1).max(12).default(3),
  startNote: z.string().trim().max(1000).optional(),
});
export type LecturePlanInput = z.infer<typeof lecturePlanSchema>;

async function ownedCourse(facultyId: number, courseId: number) {
  const course = await courseRepository.findOwnedById(courseId, facultyId);
  if (!course) throw new AppError("Course not found", 404);
  return course;
}

export const lecturePlanService = {
  generate(facultyId: number, courseId: number, input: LecturePlanInput) {
    return tracedAnalysis(async () => {
      await ownedCourse(facultyId, courseId);
      const [syllabusText, outcomes, materials] = await Promise.all([
        loadSyllabusText(courseId),
        courseRepository.findOutcomes(courseId),
        prisma.teachingMaterial.findMany({ where: { courseId }, select: { title: true }, orderBy: { uploadedAt: "asc" } }),
      ]);

      const { consensus } = await runLlmAnalysis(
        LECTURE_PLAN_PROMPT,
        [
          {
            weeks: input.weeks,
            hoursPerWeek: input.hoursPerWeek,
            syllabusText,
            courseOutcomes: outcomes.map((o) => ({ code: o.code, description: o.description })),
            materialTitles: materials.map((m) => m.title),
            startNote: input.startNote,
          },
        ],
        lecturePlanResponseSchema
      );

      // Normalise week numbering so the UI can trust it even if the model drifted.
      const weeks = [...consensus.weeks].sort((a, b) => a.week - b.week).slice(0, input.weeks).map((w, index) => ({ ...w, week: index + 1 }));
      const assumptions = [...(consensus.assumptions ?? [])];
      if (weeks.length < input.weeks) {
        assumptions.push(`The model produced ${weeks.length} of ${input.weeks} requested weeks.`);
      }
      const plan = await prisma.lecturePlan.create({
        data: {
          courseId,
          weeks: weeks.length,
          hoursPerWeek: input.hoursPerWeek,
          planJson: { ...consensus, weeks, assumptions } as unknown as Prisma.InputJsonValue,
        },
      });
      await auditService.recordAuditLog({ userId: facultyId, action: "Faculty generated lecture plan", document: `course:${courseId}` });
      return plan;
    });
  },

  async list(facultyId: number, courseId: number) {
    await ownedCourse(facultyId, courseId);
    return prisma.lecturePlan.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 10 });
  },

  async remove(facultyId: number, courseId: number, planId: number) {
    await ownedCourse(facultyId, courseId);
    const result = await prisma.lecturePlan.deleteMany({ where: { id: planId, courseId } });
    if (!result.count) throw new AppError("Lecture plan not found", 404);
    return { id: planId };
  },
};
