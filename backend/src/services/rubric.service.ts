import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { runLlmAnalysis } from "../ai/runner";
import { RUBRIC_GENERATION_PROMPT } from "../ai/prompts/facultyWorkflows.prompt";
import { rubricGenerationResponseSchema } from "../ai/schemas/facultyWorkflows.schema";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { env } from "../config/env";
import { loadAnalysisContext, fitSyllabusToPrompt } from "./analysisContext.service";
import { teachingMaterialService } from "./teachingMaterial.service";
import { tracedAnalysis } from "./traced";
import { auditService } from "./audit.service";

export const generateRubricSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  questionPaperId: z.coerce.number().int().positive(),
  questionIds: z.array(z.coerce.number().int().positive()).min(1).max(100).optional(),
  name: z.string().trim().min(2).max(160).optional(),
});
export type GenerateRubricInput = z.infer<typeof generateRubricSchema>;

export interface RubricQuestionScheme {
  questionId: number;
  sequenceNumber: number;
  marks: number;
  modelAnswer: string;
  markingPoints: Array<{ point: string; marks: number }>;
  partialCreditRules: string[];
  commonErrors: string[];
}

export interface RubricCriteria {
  questions: RubricQuestionScheme[];
  generalGuidance: string[];
  /** Questions whose marking points had to be rescaled to sum to the question marks. */
  rescaled: number[];
}

const round = (value: number) => Math.round(value * 2) / 2;

/** Rescales marking points so they sum to the question's marks; the LLM is close but rarely exact. */
function fitMarkingPoints(points: Array<{ point: string; marks: number }>, target: number): { points: Array<{ point: string; marks: number }>; rescaled: boolean } {
  const sum = points.reduce((s, p) => s + p.marks, 0);
  if (target <= 0 || Math.abs(sum - target) < 0.01) return { points, rescaled: false };
  if (sum <= 0) {
    const each = round(target / points.length);
    const fitted = points.map((p) => ({ ...p, marks: each }));
    fitted[fitted.length - 1].marks = round(target - each * (points.length - 1));
    return { points: fitted, rescaled: true };
  }
  const fitted = points.map((p) => ({ ...p, marks: round((p.marks / sum) * target) }));
  const drift = target - fitted.reduce((s, p) => s + p.marks, 0);
  fitted[fitted.length - 1].marks = round(fitted[fitted.length - 1].marks + drift);
  return { points: fitted, rescaled: true };
}

async function loadOwnedRubric(facultyId: number, rubricId: number) {
  const rubric = await prisma.rubric.findFirst({ where: { id: rubricId, course: { facultyId } }, include: { course: { select: { courseCode: true, courseName: true } }, questionPaper: { select: { year: true, semester: true } } } });
  if (!rubric) throw new AppError("Marking scheme not found", 404);
  return rubric;
}

export const rubricService = {
  generate(facultyId: number, input: GenerateRubricInput) {
    return tracedAnalysis(async () => {
      const { course, paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
      const requested = input.questionIds ? new Set(input.questionIds) : null;
      const selected = requested ? questions.filter((q) => requested.has(q.id)) : questions;
      if (requested && selected.length !== requested.size) throw new AppError("One or more questionIds do not belong to this question paper", 422);

      const syllabus = await documentRepository.findLatestSyllabus(input.courseId);
      const syllabusText = syllabus?.extractedText ? fitSyllabusToPrompt(syllabus.extractedText, Math.floor(env.syllabusPromptChars / 2)) : undefined;
      const materials = await teachingMaterialService.excerptForGeneration(input.courseId, Math.floor(env.syllabusPromptChars / 2));

      const { consensus } = await runLlmAnalysis(
        RUBRIC_GENERATION_PROMPT,
        [
          {
            questions: selected.map((q) => ({ id: q.id, sequenceNumber: q.sequenceNumber, text: q.questionText, marks: Number(q.marks), bloomLevel: q.bloomLevel })),
            syllabusText,
            teachingMaterialText: materials.text || undefined,
          },
        ],
        rubricGenerationResponseSchema
      );

      const byId = new Map(selected.map((q) => [q.id, q]));
      const rescaled: number[] = [];
      const schemes: RubricQuestionScheme[] = [];
      for (const item of consensus.questions) {
        const question = byId.get(item.questionId);
        if (!question) continue;
        const fit = fitMarkingPoints(item.markingPoints, Number(question.marks));
        if (fit.rescaled) rescaled.push(question.sequenceNumber);
        schemes.push({
          questionId: question.id,
          sequenceNumber: question.sequenceNumber,
          marks: Number(question.marks),
          modelAnswer: item.modelAnswer,
          markingPoints: fit.points,
          partialCreditRules: item.partialCreditRules ?? [],
          commonErrors: item.commonErrors ?? [],
        });
      }
      const missing = selected.filter((q) => !schemes.some((s) => s.questionId === q.id));
      if (missing.length) throw new AppError(`The model skipped Q${missing.map((q) => q.sequenceNumber).join(", Q")}; please retry`, 502);
      schemes.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      const criteria: RubricCriteria = { questions: schemes, generalGuidance: consensus.generalGuidance ?? [], rescaled };
      const rubric = await prisma.rubric.create({
        data: {
          courseId: course.id,
          questionPaperId: paper.id,
          createdById: facultyId,
          name: input.name ?? `${course.courseCode} ${paper.semester} ${paper.year} marking scheme`,
          description: `AI-drafted marking scheme for ${schemes.length} question${schemes.length === 1 ? "" : "s"}; review before use.`,
          criteria: criteria as unknown as Prisma.InputJsonValue,
          maxScore: schemes.reduce((s, q) => s + q.marks, 0),
        },
      });
      await auditService.recordAuditLog({ userId: facultyId, action: "Faculty generated marking scheme", document: `question-paper:${paper.id}` });
      return rubric;
    });
  },

  async listForCourse(facultyId: number, courseId: number) {
    const course = await courseRepository.findOwnedById(courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);
    return prisma.rubric.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } });
  },

  get: loadOwnedRubric,

  async remove(facultyId: number, rubricId: number) {
    await loadOwnedRubric(facultyId, rubricId);
    await prisma.rubric.delete({ where: { id: rubricId } });
    return { id: rubricId };
  },

  async markdown(facultyId: number, rubricId: number): Promise<{ filename: string; content: string }> {
    const rubric = await loadOwnedRubric(facultyId, rubricId);
    const criteria = rubric.criteria as unknown as RubricCriteria;
    const lines: string[] = [
      `# ${rubric.name}`,
      "",
      `${rubric.course.courseCode} — ${rubric.course.courseName}${rubric.questionPaper ? ` · ${rubric.questionPaper.semester} ${rubric.questionPaper.year}` : ""}`,
      `Total marks: ${Number(rubric.maxScore)} · Drafted ${rubric.createdAt.toISOString().slice(0, 10)} · AI-assisted; moderated by: ____________`,
      "",
    ];
    for (const q of criteria.questions) {
      lines.push(`## Q${q.sequenceNumber} (${q.marks} marks)`, "", "**Model answer**", "", q.modelAnswer, "", "**Marking points**", "");
      lines.push("| Point | Marks |", "|---|---|");
      for (const p of q.markingPoints) lines.push(`| ${p.point.replace(/\|/g, "\\|")} | ${p.marks} |`);
      if (q.partialCreditRules.length) lines.push("", "**Partial credit**", "", ...q.partialCreditRules.map((r) => `- ${r}`));
      if (q.commonErrors.length) lines.push("", "**Common errors**", "", ...q.commonErrors.map((r) => `- ${r}`));
      lines.push("");
    }
    if (criteria.generalGuidance.length) lines.push("## General guidance", "", ...criteria.generalGuidance.map((g) => `- ${g}`), "");
    return { filename: `${rubric.course.courseCode}-marking-scheme-${rubric.id}.md`, content: lines.join("\n") };
  },
};
