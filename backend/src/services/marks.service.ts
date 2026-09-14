import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { auditService } from "./audit.service";
import { analyzeItems, groupAttainment, ItemInput, MarkRow, parseMarksCsv } from "./marks/itemAnalysis";

export const marksUploadSchema = z.union([
  z.object({ csv: z.string().min(3).max(2_000_000) }),
  z.object({
    rows: z
      .array(
        z.object({
          student: z.string().trim().min(1).max(100),
          /** sequenceNumber -> marks */
          marks: z.record(z.string(), z.coerce.number().min(0).max(10_000)),
        })
      )
      .min(1)
      .max(5_000),
  }),
]);
export type MarksUploadInput = z.infer<typeof marksUploadSchema>;

export const marksAnalysisQuerySchema = z.object({
  passMark: z.coerce.number().min(0).max(100).default(40),
  threshold: z.coerce.number().min(0).max(100).default(60),
});

export async function loadOwnedPaper(facultyId: number, paperId: number) {
  const paper = await documentRepository.findQuestionPaperById(paperId);
  if (!paper) throw new AppError("Question paper not found", 404);
  const course = await courseRepository.findOwnedById(paper.courseId, facultyId);
  if (!course) throw new AppError("Question paper not found", 404);
  return { paper, course };
}

function toItemInputs(questions: Awaited<ReturnType<typeof questionRepository.findByPaperId>>): ItemInput[] {
  return questions.map((question) => ({
    questionId: question.id,
    sequenceNumber: question.sequenceNumber,
    maxMarks: Number(question.marks),
    bloomLevel: question.bloomLevel,
    topic: question.topic,
    text: question.questionText,
  }));
}

export const marksService = {
  async upload(facultyId: number, paperId: number, input: MarksUploadInput) {
    const { paper } = await loadOwnedPaper(facultyId, paperId);
    const questions = await questionRepository.findByPaperId(paper.id);
    if (!questions.length) throw new AppError("The question paper has no extracted questions to attach marks to", 422);
    const bySequence = new Map(questions.map((question) => [question.sequenceNumber, question]));

    let parsedRows: Array<{ student: string; marks: Map<number, number> }>;
    let ignoredColumns: string[] = [];
    if ("csv" in input) {
      try {
        const parsed = parseMarksCsv(input.csv);
        parsedRows = parsed.rows;
        ignoredColumns = parsed.ignoredColumns;
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : "Could not parse CSV", 422);
      }
    } else {
      parsedRows = input.rows.map((row) => ({
        student: row.student,
        marks: new Map(Object.entries(row.marks).map(([seq, value]) => [Number(seq), value])),
      }));
    }

    const referenced = new Set<number>();
    for (const row of parsedRows) for (const seq of row.marks.keys()) referenced.add(seq);
    const unknownSequences = [...referenced].filter((seq) => !bySequence.has(seq));
    const matchedSequences = [...referenced].filter((seq) => bySequence.has(seq));
    if (!matchedSequences.length) {
      throw new AppError(`None of the columns match this paper's questions (Q1–Q${Math.max(...bySequence.keys())})`, 422);
    }
    const overMax: string[] = [];
    const creates: Prisma.StudentMarkCreateManyInput[] = [];
    for (const row of parsedRows) {
      for (const seq of matchedSequences) {
        const question = bySequence.get(seq)!;
        const value = row.marks.get(seq) ?? 0;
        if (Number(question.marks) > 0 && value > Number(question.marks)) overMax.push(`${row.student} Q${seq} (${value}/${Number(question.marks)})`);
        creates.push({ paperId: paper.id, questionId: question.id, studentIdentifier: row.student.slice(0, 100), marks: value });
      }
    }
    if (overMax.length) {
      throw new AppError(`Marks exceed the question maximum for: ${overMax.slice(0, 5).join(", ")}${overMax.length > 5 ? ` and ${overMax.length - 5} more` : ""}`, 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentMark.deleteMany({ where: { paperId: paper.id } });
      for (let i = 0; i < creates.length; i += 1_000) await tx.studentMark.createMany({ data: creates.slice(i, i + 1_000) });
    });
    await auditService.recordAuditLog({ userId: facultyId, action: "Faculty uploaded student marks", document: `question-paper:${paper.id}` });

    return {
      paperId: paper.id,
      students: parsedRows.length,
      questionsMatched: matchedSequences.length,
      questionsInPaper: questions.length,
      unmatchedQuestions: questions.filter((question) => !referenced.has(question.sequenceNumber)).map((question) => question.sequenceNumber),
      unknownColumns: [...unknownSequences.map((seq) => `Q${seq}`), ...ignoredColumns],
    };
  },

  async summary(facultyId: number, paperId: number) {
    const { paper } = await loadOwnedPaper(facultyId, paperId);
    const [students, latest] = await Promise.all([
      prisma.studentMark.groupBy({ by: ["studentIdentifier"], where: { paperId: paper.id } }),
      prisma.studentMark.findFirst({ where: { paperId: paper.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    return { paperId: paper.id, students: students.length, uploadedAt: latest?.createdAt ?? null };
  },

  async remove(facultyId: number, paperId: number) {
    const { paper } = await loadOwnedPaper(facultyId, paperId);
    const result = await prisma.studentMark.deleteMany({ where: { paperId: paper.id } });
    return { paperId: paper.id, deleted: result.count };
  },

  async analyze(facultyId: number, paperId: number, options: z.infer<typeof marksAnalysisQuerySchema>) {
    const { paper, course } = await loadOwnedPaper(facultyId, paperId);
    const [questions, marks, coReport] = await Promise.all([
      questionRepository.findByPaperId(paper.id),
      prisma.studentMark.findMany({ where: { paperId: paper.id }, select: { studentIdentifier: true, questionId: true, marks: true } }),
      prisma.analysisReport.findFirst({
        where: { questionPaperId: paper.id, reportType: "CO_MAPPING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, coMappings: { select: { questionId: true, strength: true, courseOutcome: { select: { code: true, description: true } } } } },
      }),
    ]);
    if (!marks.length) throw new AppError("No marks uploaded for this paper yet", 404);

    const rowMap = new Map<string, MarkRow>();
    for (const mark of marks) {
      const row = rowMap.get(mark.studentIdentifier) ?? { student: mark.studentIdentifier, marks: new Map<number, number>() };
      row.marks.set(mark.questionId, Number(mark.marks));
      rowMap.set(mark.studentIdentifier, row);
    }
    const rows = [...rowMap.values()];
    const scoredQuestionIds = new Set(marks.map((mark) => mark.questionId));
    const items = toItemInputs(questions.filter((question) => scoredQuestionIds.has(question.id)));

    const analysis = analyzeItems(rows, items, { passMarkPercent: options.passMark, thresholdPercent: options.threshold });

    const coGroups = new Map<string, { label: string; questionIds: Set<number> }>();
    for (const mapping of coReport?.coMappings ?? []) {
      if (mapping.strength === "WEAK") continue;
      const group = coGroups.get(mapping.courseOutcome.code) ?? { label: mapping.courseOutcome.description, questionIds: new Set<number>() };
      group.questionIds.add(mapping.questionId);
      coGroups.set(mapping.courseOutcome.code, group);
    }
    const coAttainment = groupAttainment(
      rows,
      items,
      [...coGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, group]) => ({ key: code, label: group.label, questionIds: [...group.questionIds] })),
      options.threshold
    );
    for (const co of coAttainment) {
      if (co.attainmentLevel === 0) {
        analysis.recommendations.push({ priority: "HIGH", message: `${co.key} not attained: only ${co.studentsAboveThreshold}% of students reached ${options.threshold}% on Q${co.questionSequence.join(", Q")}.` });
      }
    }

    return {
      paperId: paper.id,
      courseId: course.id,
      paper: { year: paper.year, semester: paper.semester },
      thresholdPercent: options.threshold,
      ...analysis,
      coAttainment,
      coMappingSource: coReport ? { reportId: coReport.id, createdAt: coReport.createdAt } : null,
      note: coReport
        ? "CO attainment uses the latest CO-mapping report for this paper (WEAK mappings excluded)."
        : "Run CO mapping on this paper to see CO attainment.",
    };
  },
};
