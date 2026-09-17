import { z } from "zod";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";

export const questionBankQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  bloom: z.string().trim().max(30).optional(),
  topic: z.string().trim().max(191).optional(),
  paperId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(300),
});
export type QuestionBankQuery = z.infer<typeof questionBankQuerySchema>;

/** Every question the course has ever asked, filterable, with how often a near-identical text recurs. */
export const questionBankService = {
  async list(facultyId: number, courseId: number, query: QuestionBankQuery) {
    const course = await courseRepository.findOwnedById(courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);

    const rows = await prisma.question.findMany({
      where: {
        paper: { courseId, ...(query.paperId ? { id: query.paperId } : {}) },
        ...(query.bloom ? { bloomLevel: query.bloom } : {}),
        ...(query.topic ? { topic: query.topic } : {}),
        ...(query.q ? { questionText: { contains: query.q } } : {}),
      },
      select: {
        id: true,
        paperId: true,
        sequenceNumber: true,
        questionText: true,
        marks: true,
        topic: true,
        bloomLevel: true,
        paper: { select: { id: true, year: true, semester: true } },
      },
      orderBy: [{ paper: { year: "desc" } }, { paper: { uploadedAt: "desc" } }, { sequenceNumber: "asc" }],
      take: query.limit,
    });

    const [topics, blooms] = await Promise.all([
      prisma.question.findMany({ where: { paper: { courseId }, topic: { not: null } }, select: { topic: true }, distinct: ["topic"] }),
      prisma.question.findMany({ where: { paper: { courseId }, bloomLevel: { not: null } }, select: { bloomLevel: true }, distinct: ["bloomLevel"] }),
    ]);

    // Same normalised text across papers = a literally re-used question.
    const allTexts = await prisma.question.findMany({ where: { paper: { courseId } }, select: { questionText: true } });
    const counts = new Map<string, number>();
    const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    for (const row of allTexts) counts.set(norm(row.questionText), (counts.get(norm(row.questionText)) ?? 0) + 1);

    return {
      questions: rows.map((row) => ({ ...row, marks: Number(row.marks), usedCount: counts.get(norm(row.questionText)) ?? 1 })),
      topics: topics.map((t) => t.topic!).sort(),
      bloomLevels: blooms.map((b) => b.bloomLevel!),
    };
  },
};
