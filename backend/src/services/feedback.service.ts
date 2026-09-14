import { z } from "zod";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";

const bloom = z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]);

export const questionFeedbackSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  reportId: z.coerce.number().int().positive().optional(),
  verdict: z.enum(["UP", "DOWN"]),
  aiBloomLevel: bloom.optional(),
  correctedBloomLevel: bloom.optional(),
  aiTopic: z.string().trim().max(191).optional(),
  correctedTopic: z.string().trim().min(1).max(191).optional(),
  note: z.string().trim().max(2000).optional(),
});
export type QuestionFeedbackInput = z.infer<typeof questionFeedbackSchema>;

const BLOOM_ORDER = bloom.options;

/**
 * Cohen's kappa between AI and faculty Bloom labels over corrected rows.
 * Only computed once there are enough labels for the number to mean anything.
 */
function cohensKappa(pairs: Array<[string, string]>): number | null {
  if (pairs.length < 10) return null;
  const n = pairs.length;
  const agree = pairs.filter(([a, b]) => a === b).length / n;
  let expected = 0;
  for (const label of BLOOM_ORDER) {
    const pa = pairs.filter(([a]) => a === label).length / n;
    const pb = pairs.filter(([, b]) => b === label).length / n;
    expected += pa * pb;
  }
  if (expected === 1) return 1;
  return Math.round(((agree - expected) / (1 - expected)) * 1000) / 1000;
}

export const feedbackService = {
  async submit(facultyId: number, input: QuestionFeedbackInput) {
    const question = await prisma.question.findUnique({
      where: { id: input.questionId },
      select: { id: true, bloomLevel: true, topic: true, paper: { select: { course: { select: { facultyId: true } } } } },
    });
    if (!question || question.paper.course.facultyId !== facultyId) throw new AppError("Question not found", 404);
    if (input.reportId) {
      const report = await prisma.analysisReport.findUnique({ where: { id: input.reportId }, select: { facultyId: true } });
      if (!report || report.facultyId !== facultyId) throw new AppError("Report not found", 404);
    }
    const data = {
      verdict: input.verdict,
      aiBloomLevel: input.aiBloomLevel ?? question.bloomLevel ?? null,
      correctedBloomLevel: input.correctedBloomLevel ?? null,
      aiTopic: input.aiTopic ?? question.topic ?? null,
      correctedTopic: input.correctedTopic ?? null,
      note: input.note ?? null,
    };
    // MySQL unique indexes treat NULL reportId as distinct, so resolve the row explicitly.
    const existing = await prisma.questionFeedback.findFirst({
      where: { questionId: input.questionId, reportId: input.reportId ?? null, facultyId },
    });
    const feedback = existing
      ? await prisma.questionFeedback.update({ where: { id: existing.id }, data })
      : await prisma.questionFeedback.create({ data: { questionId: input.questionId, reportId: input.reportId ?? null, facultyId, ...data } });
    // A faculty correction is the best label we have: write it back to the question.
    if (input.correctedBloomLevel || input.correctedTopic) {
      await prisma.question.update({
        where: { id: input.questionId },
        data: {
          bloomLevel: input.correctedBloomLevel ?? undefined,
          topic: input.correctedTopic ?? undefined,
        },
      });
    }
    return feedback;
  },

  listForReport(facultyId: number, reportId: number) {
    return prisma.questionFeedback.findMany({ where: { facultyId, reportId }, orderBy: { createdAt: "desc" } });
  },

  /** Aggregate agreement between AI labels and faculty corrections; kappa appears at n ≥ 10. */
  async stats(facultyId: number, courseId?: number) {
    const rows = await prisma.questionFeedback.findMany({
      where: { facultyId, question: courseId ? { paper: { courseId } } : undefined },
      select: { verdict: true, aiBloomLevel: true, correctedBloomLevel: true },
    });
    const pairs = rows
      .filter((row) => row.aiBloomLevel && row.correctedBloomLevel)
      .map((row) => [row.aiBloomLevel!, row.correctedBloomLevel!] as [string, string]);
    const bloomAgreement = pairs.length ? Math.round((pairs.filter(([a, b]) => a === b).length / pairs.length) * 100) : null;
    return {
      total: rows.length,
      thumbsUp: rows.filter((row) => row.verdict === "UP").length,
      thumbsDown: rows.filter((row) => row.verdict === "DOWN").length,
      bloomCorrections: pairs.length,
      bloomAgreementPercent: bloomAgreement,
      cohensKappa: cohensKappa(pairs),
      kappaNote: pairs.length < 10 ? `Cohen's κ reported once ≥ 10 Bloom corrections exist (${pairs.length} so far).` : "Cohen's κ between AI and faculty Bloom labels.",
    };
  },
};
