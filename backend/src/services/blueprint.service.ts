import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { questionRepository } from "../repositories/question.repository";
import { documentRepository } from "../repositories/document.repository";

const BLOOM_LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;
const DEFAULT_BLOOM: Record<string, number> = { REMEMBER: 10, UNDERSTAND: 20, APPLY: 30, ANALYZE: 20, EVALUATE: 10, CREATE: 10 };

const weights = z.record(z.string().trim().min(1).max(60), z.coerce.number().min(0).max(100));

export const blueprintSchema = z.object({
  targetBloom: z.record(z.enum(BLOOM_LEVELS), z.coerce.number().min(0).max(100)),
  outcomeWeights: weights.nullable().optional(),
  topicWeights: weights.nullable().optional(),
  totalMarks: z.coerce.number().int().min(10).max(500).default(100),
  questionCount: z.coerce.number().int().min(1).max(60).default(8),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type BlueprintInput = z.infer<typeof blueprintSchema>;

/** Percent map normalised to sum 100; empty/zero maps come back empty. */
export function normalisePercent(map: Record<string, number>): Record<string, number> {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([k, v]) => [k, Math.round((v / total) * 1000) / 10]));
}

async function ownedCourse(facultyId: number, courseId: number) {
  const course = await courseRepository.findOwnedById(courseId, facultyId);
  if (!course) throw new AppError("Course not found", 404);
  return course;
}

function deviationRows<K extends string>(
  keyName: K,
  target: Record<string, number>,
  observed: Record<string, number>
): Array<Record<K, string> & { target: number; observed: number; deviation: number }> {
  const keys = [...new Set([...Object.keys(target), ...Object.keys(observed)])];
  return keys
    .map((key) => {
      const t = target[key] ?? 0;
      const o = observed[key] ?? 0;
      return { [keyName]: key, target: t, observed: o, deviation: Math.round((o - t) * 10) / 10 } as Record<K, string> & { target: number; observed: number; deviation: number };
    })
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

export const blueprintService = {
  async get(facultyId: number, courseId: number) {
    await ownedCourse(facultyId, courseId);
    const stored = await prisma.examBlueprint.findUnique({ where: { courseId } });
    if (stored) return { ...stored, isDefault: false };
    return {
      courseId,
      targetBloom: DEFAULT_BLOOM,
      outcomeWeights: null,
      topicWeights: null,
      totalMarks: 100,
      questionCount: 8,
      notes: null,
      isDefault: true,
    };
  },

  async save(facultyId: number, courseId: number, input: BlueprintInput) {
    await ownedCourse(facultyId, courseId);
    const targetBloom = normalisePercent(input.targetBloom);
    if (!Object.keys(targetBloom).length) throw new AppError("targetBloom must have at least one non-zero level", 422);
    const data = {
      targetBloom: targetBloom as Prisma.InputJsonValue,
      outcomeWeights: input.outcomeWeights ? (normalisePercent(input.outcomeWeights) as Prisma.InputJsonValue) : Prisma.JsonNull,
      topicWeights: input.topicWeights ? (normalisePercent(input.topicWeights) as Prisma.InputJsonValue) : Prisma.JsonNull,
      totalMarks: input.totalMarks,
      questionCount: input.questionCount,
      notes: input.notes ?? null,
    };
    const stored = await prisma.examBlueprint.upsert({ where: { courseId }, create: { courseId, ...data }, update: data });
    return { ...stored, isDefault: false };
  },

  /**
   * Deterministic fit of one paper against the course blueprint using the persisted
   * Bloom/topic labels and the latest CO mapping. Unlabelled questions are reported,
   * not guessed.
   */
  async compare(facultyId: number, courseId: number, paperId: number) {
    await ownedCourse(facultyId, courseId);
    const paper = await documentRepository.findQuestionPaperById(paperId);
    if (!paper || paper.courseId !== courseId) throw new AppError("Question paper not found for this course", 404);
    const [blueprint, questions, coReport] = await Promise.all([
      this.get(facultyId, courseId),
      questionRepository.findByPaperId(paperId),
      prisma.analysisReport.findFirst({
        where: { questionPaperId: paperId, reportType: "CO_MAPPING" },
        orderBy: { createdAt: "desc" },
        select: { coMappings: { select: { questionId: true, strength: true, courseOutcome: { select: { code: true } } } } },
      }),
    ]);
    if (!questions.length) throw new AppError("The question paper contains no extracted questions", 422);

    const totalMarks = questions.reduce((s, q) => s + Number(q.marks), 0);
    const labelled = questions.filter((q) => q.bloomLevel);
    const labelledMarks = labelled.reduce((s, q) => s + Number(q.marks), 0);
    const observedBloom: Record<string, number> = {};
    for (const q of labelled) observedBloom[q.bloomLevel!] = (observedBloom[q.bloomLevel!] ?? 0) + Number(q.marks);
    const bloom = deviationRows("level", blueprint.targetBloom as Record<string, number>, normalisePercent(observedBloom));

    let outcomes: ReturnType<typeof deviationRows<"code">> | null = null;
    if (blueprint.outcomeWeights && Object.keys(blueprint.outcomeWeights).length && coReport) {
      const marksById = new Map(questions.map((q) => [q.id, Number(q.marks)]));
      const perQuestionCos = new Map<number, string[]>();
      for (const m of coReport.coMappings) {
        if (m.strength === "WEAK") continue;
        perQuestionCos.set(m.questionId, [...(perQuestionCos.get(m.questionId) ?? []), m.courseOutcome.code]);
      }
      const observedCo: Record<string, number> = {};
      for (const [questionId, codes] of perQuestionCos) {
        const share = (marksById.get(questionId) ?? 0) / codes.length;
        for (const code of codes) observedCo[code] = (observedCo[code] ?? 0) + share;
      }
      outcomes = deviationRows("code", blueprint.outcomeWeights as Record<string, number>, normalisePercent(observedCo));
    }

    let topics: ReturnType<typeof deviationRows<"topic">> | null = null;
    if (blueprint.topicWeights && Object.keys(blueprint.topicWeights).length) {
      const observedTopic: Record<string, number> = {};
      for (const q of questions) if (q.topic) observedTopic[q.topic] = (observedTopic[q.topic] ?? 0) + Number(q.marks);
      topics = deviationRows("topic", blueprint.topicWeights as Record<string, number>, normalisePercent(observedTopic));
    }

    const allDeviations = [...bloom, ...(outcomes ?? []), ...(topics ?? [])].map((r) => Math.abs(r.deviation));
    const maxAbsDeviation = allDeviations.length ? Math.max(...allDeviations) : 0;
    const meanAbs = allDeviations.length ? allDeviations.reduce((s, d) => s + d, 0) / allDeviations.length : 0;
    const fitScore = Math.max(0, Math.round(100 - meanAbs * 2));
    const notes: string[] = [];
    if (labelled.length < questions.length) notes.push(`${questions.length - labelled.length} question(s) have no Bloom label — run a question review to label them.`);
    if (blueprint.isDefault) notes.push("No blueprint saved for this course; comparing against the default distribution.");
    if (blueprint.outcomeWeights && !coReport) notes.push("Run CO mapping on this paper to compare outcome weights.");
    if (Math.abs(totalMarks - blueprint.totalMarks) > 0) notes.push(`Paper totals ${totalMarks} marks; blueprint expects ${blueprint.totalMarks}.`);
    if (questions.length !== blueprint.questionCount) notes.push(`Paper has ${questions.length} questions; blueprint expects ${blueprint.questionCount}.`);

    return {
      courseId,
      paperId,
      totalMarks,
      labelledMarks,
      unlabelledQuestions: questions.length - labelled.length,
      bloom,
      outcomes,
      topics,
      maxAbsDeviation,
      fitScore,
      verdict: maxAbsDeviation <= 5 ? "ON_TARGET" : maxAbsDeviation <= 15 ? "MINOR_DRIFT" : "OFF_TARGET",
      notes,
    };
  },
};
