import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { AppError } from "../middleware/error.middleware";
import { reportService } from "./report.service";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { embeddingService } from "../ai/embedding/embeddingService";
import { questionSearchService } from "./questionSearch.service";
import { auditService } from "./audit.service";
import { normalizeSemester, CANONICAL_SEMESTERS } from "../validators/document.validator";
import { logger } from "../utils/logger";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

interface GeneratedQuestion {
  sequenceNumber: number;
  text: string;
  marks: number;
  intendedBloom: string;
  intendedOutcome: string | null;
  topic: string;
}

interface GeneratedPaperPayload {
  paper: { title: string; questions: GeneratedQuestion[]; designNotes: string };
  constraints: { totalMarks: number; questionCount: number };
  verification: { objective: number; passed: boolean };
}

export const adoptPaperSchema = z.object({
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 2),
  semester: z.string().trim().min(1).max(50).transform((value, context) => {
    const canonical = normalizeSemester(value);
    if (!canonical) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Unrecognised semester. Use one of: ${CANONICAL_SEMESTERS.join(", ")}` });
      return z.NEVER;
    }
    return canonical;
  }),
  /** Include Bloom/CO/topic annotations in the exported document (off for a student-facing paper). */
  includeAnnotations: z.coerce.boolean().default(false),
});
export type AdoptPaperInput = z.infer<typeof adoptPaperSchema>;

async function loadGenerated(reportId: number, facultyId: number) {
  const report = await reportService.getById(reportId, facultyId);
  if (report.reportType !== "GENERATED_PAPER") throw new AppError("This report is not a generated paper", 400);
  const payload = report.resultJson as unknown as GeneratedPaperPayload;
  if (!payload?.paper?.questions?.length) throw new AppError("The generated paper has no questions", 409);
  const course = report.courseId ? await courseRepository.findById(report.courseId) : null;
  return { report, payload, course };
}

function paperHeaderLines(course: { courseCode: string; courseName: string } | null, payload: GeneratedPaperPayload, meta?: { year: number; semester: string }) {
  return [
    course ? `${course.courseCode} — ${course.courseName}` : "",
    meta ? `${meta.semester} ${meta.year}` : "",
    `Total marks: ${payload.constraints.totalMarks} · Questions: ${payload.paper.questions.length}`,
  ].filter(Boolean);
}

/** Student-facing exam paper: title block, instructions, numbered questions with marks. */
export function renderPaperPdf(
  payload: GeneratedPaperPayload,
  course: { courseCode: string; courseName: string } | null,
  options: { includeAnnotations?: boolean; year?: number; semester?: string } = {}
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: payload.paper.title } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(18).text(payload.paper.title, { align: "center" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11).fillColor("#374151");
  for (const line of paperHeaderLines(course, payload, options.year && options.semester ? { year: options.year, semester: options.semester } : undefined)) {
    doc.text(line, { align: "center" });
  }
  doc.moveDown(0.6);
  doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).strokeColor("#9ca3af").lineWidth(1).stroke();
  doc.moveDown(0.6);
  doc.fillColor("#111827").fontSize(10).font("Helvetica-Oblique").text("Answer all questions. Marks for each question are shown in brackets.");
  doc.moveDown(1);

  const sorted = [...payload.paper.questions].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  for (const q of sorted) {
    const marks = `[${q.marks} marks]`;
    const width = doc.page.width - 112;
    const needed = doc.heightOfString(q.text, { width: width - 90 }) + 28;
    if (doc.y + needed > doc.page.height - 70) doc.addPage();
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(`${q.sequenceNumber}.`, 56, y, { width: 24 });
    doc.font("Helvetica").fontSize(11).text(q.text, 82, y, { width: width - 90, lineGap: 2 });
    const bottom = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text(marks, doc.page.width - 56 - 70, y, { width: 70, align: "right" });
    doc.y = bottom;
    if (options.includeAnnotations) {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#6b7280")
        .text(`Bloom: ${q.intendedBloom}${q.intendedOutcome ? ` · ${q.intendedOutcome}` : ""} · ${q.topic}`, 82, doc.y, { width: width - 90 });
    }
    doc.moveDown(0.9);
  }

  doc.moveDown(1);
  doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6b7280").text("— End of paper —", { align: "center" });
  doc.end();
  return done;
}

export function renderPaperText(payload: GeneratedPaperPayload, course: { courseCode: string; courseName: string } | null, includeAnnotations = false): string {
  const lines: string[] = [`# ${payload.paper.title}`, ...paperHeaderLines(course, payload), "", "Answer all questions. Marks for each question are shown in brackets.", ""];
  for (const q of [...payload.paper.questions].sort((a, b) => a.sequenceNumber - b.sequenceNumber)) {
    lines.push(`${q.sequenceNumber}. ${q.text} [${q.marks} marks]`);
    if (includeAnnotations) lines.push(`   _Bloom: ${q.intendedBloom}${q.intendedOutcome ? ` · ${q.intendedOutcome}` : ""} · ${q.topic}_`);
    lines.push("");
  }
  return lines.join("\n");
}

export const generatedPaperService = {
  async exportPdf(reportId: number, facultyId: number, includeAnnotations: boolean) {
    const { report, payload, course } = await loadGenerated(reportId, facultyId);
    const buffer = await renderPaperPdf(payload, course, { includeAnnotations });
    const slug = `${course?.courseCode ?? "paper"}-generated-${report.id}`.replace(/[^a-z0-9-]+/gi, "-");
    return { buffer, filename: `${slug}.pdf` };
  },

  async exportText(reportId: number, facultyId: number, includeAnnotations: boolean) {
    const { report, payload, course } = await loadGenerated(reportId, facultyId);
    const slug = `${course?.courseCode ?? "paper"}-generated-${report.id}`.replace(/[^a-z0-9-]+/gi, "-");
    return { text: renderPaperText(payload, course, includeAnnotations), filename: `${slug}.md` };
  },

  /**
   * Turns the generated paper into a real QuestionPaper in the course: writes the
   * PDF into uploads, stores the questions (with their Bloom/topic labels), adds them
   * to academic memory, indexes embeddings and runs the duplicate check — so the
   * draft can be analysed, corrected and compared like any uploaded paper.
   */
  async adopt(reportId: number, facultyId: number, input: AdoptPaperInput) {
    const { report, payload, course } = await loadGenerated(reportId, facultyId);
    if (!report.courseId || !course) throw new AppError("The course for this paper no longer exists", 409);
    const owned = await courseRepository.findOwnedById(report.courseId, facultyId);
    if (!owned) throw new AppError("Course not found", 404);

    const buffer = await renderPaperPdf(payload, course, { includeAnnotations: input.includeAnnotations, year: input.year, semester: input.semester });
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, `${randomUUID()}.pdf`);
    await fs.writeFile(filePath, buffer);
    const originalName = `${course.courseCode}-${input.semester}-${input.year}-generated-${report.id}.pdf`.replace(/\s+/g, "_");

    const paper = await documentRepository.createQuestionPaperWithQuestions(
      facultyId,
      { courseId: report.courseId, year: input.year, semester: input.semester, filePath, originalName, mimeType: "application/pdf", fileSize: buffer.length },
      [...payload.paper.questions]
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
        .map((q) => ({ sequenceNumber: q.sequenceNumber, questionText: q.text, marks: Math.round(q.marks), bloomLevel: q.intendedBloom, topic: q.topic.slice(0, 191) }))
    );
    await auditService.recordAuditLog({ userId: facultyId, action: "Faculty adopted generated paper", document: originalName });

    let duplicateWarnings: Awaited<ReturnType<typeof questionSearchService.duplicateWarnings>> = [];
    if (embeddingService.available) {
      try {
        await embeddingService.indexPaper(paper.id);
        duplicateWarnings = await questionSearchService.duplicateWarnings(report.courseId, paper.id);
      } catch (error) {
        logger.warn("adopted_paper_index_failed", { paperId: paper.id, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return { ...paper, duplicateWarnings, sourceReportId: report.id };
  },
};
