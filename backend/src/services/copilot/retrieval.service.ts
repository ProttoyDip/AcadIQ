import { courseRepository } from "../../repositories/course.repository";
import { documentRepository } from "../../repositories/document.repository";
import { questionRepository } from "../../repositories/question.repository";
import { reportRepository } from "../../repositories/report.repository";
import { extractDocumentText } from "../../ai/documentTextExtractor";
import { AppError } from "../../middleware/error.middleware";
import { AcademicMemoryResult, CoMappingResult, QuestionReviewResult, QuestionSimilarityResult } from "../../models/types";
import { selectRelevantContext } from "./rag.service";

/**
 * Step 1 of the retrieval flow: "Identify intent". A lightweight heuristic
 * router rather than a second LLM call — it costs nothing, adds no latency,
 * and its only job is to decide which of AcadIQ's own data categories to lead
 * with when building the prompt. Every category is still retrieved regardless
 * (see retrieveAcademicData) so the Copilot never has to guess wrong and miss
 * grounding data the faculty member actually needed.
 */
export type CopilotIntent = "SCORE" | "CO_COVERAGE" | "ACADEMIC_MEMORY" | "QUESTION_QUALITY" | "GENERAL";

const INTENT_KEYWORDS: Record<Exclude<CopilotIntent, "GENERAL">, RegExp> = {
  SCORE: /\b(score|quality|grade|rating|overall)\b/i,
  CO_COVERAGE: /\b(co\d|course outcome|outcome|coverage)\b/i,
  ACADEMIC_MEMORY: /\b(repeat|repeated|similar|similarity|duplicate|plagiar|memory|before|previous(ly)?)\b/i,
  QUESTION_QUALITY: /\b(question|clarity|bloom|rewrite|improve|difficult|difficulty)\b/i,
};

export function identifyIntent(message: string): CopilotIntent {
  for (const [intent, pattern] of Object.entries(INTENT_KEYWORDS) as [Exclude<CopilotIntent, "GENERAL">, RegExp][]) {
    if (pattern.test(message)) return intent;
  }
  return "GENERAL";
}

export interface RetrievedAcademicData {
  course: { courseCode: string; courseName: string };
  courseOutcomes: Array<{ code: string; description: string }>;
  syllabusExcerpt?: string;
  paperMetadata?: { year: number; semester: string; originalName: string };
  questions: Array<{
    sequenceNumber: number;
    questionText: string;
    marks: number;
    bloomLevel?: string | null;
    topic?: string | null;
    /** Cosine to the user's message when RAG ranked this question as relevant. */
    relevance?: number;
  }>;
  /** How the syllabus/questions were chosen for this turn. */
  retrieval: {
    method: "EMBEDDING" | "FULL_CONTEXT";
    syllabusChunks: number;
    syllabusChars: number;
    materialChunks: number;
    relevantQuestions: number[];
    reason?: string;
  };
  /** Passages from uploaded slides/notes ranked against the message. */
  materialPassages: Array<{ title: string; kind: string; locator: string | null; content: string; similarity: number }>;
  examQuality?: { qualityScore: number; issues: unknown[]; recommendations: unknown[]; positivePoints: unknown[] };
  coMapping?: CoMappingResult;
  academicMemory?: AcademicMemoryResult;
  similarity?: QuestionSimilarityResult;
  questionReview?: QuestionReviewResult;
}

/**
 * Step 2 of the retrieval flow: "Retrieve relevant AcadIQ data". Pulls from
 * every context source AcadIQ owns for this course — Course Information,
 * Exam Quality Reports, CO Intelligence, and Academic Memory — so the Copilot
 * can only ever answer from what actually exists in the system.
 */
export async function retrieveAcademicData(
  facultyId: number,
  courseId: number,
  examId?: number,
  reportId?: number,
  message = ""
): Promise<RetrievedAcademicData> {
  const course = await courseRepository.findOwnedById(courseId, facultyId);
  if (!course) {
    throw new AppError("Course not found or access denied", 404);
  }

  const courseOutcomes = await courseRepository.findOutcomes(courseId);

  // Course Information: syllabus (non-fatal if unreadable/absent)
  let syllabusText: string | undefined;
  let syllabusDoc: { id: number; extractedText: string | null } | null = null;
  try {
    const doc = await documentRepository.findLatestSyllabus(courseId);
    if (doc) {
      syllabusText = doc.extractedText?.trim() || (await extractDocumentText(doc.filePath, doc.mimeType));
      syllabusDoc = { id: doc.id, extractedText: syllabusText };
    }
  } catch {
    syllabusText = undefined;
  }

  // Course Information: the question paper this conversation is scoped to
  let paperMetadata: RetrievedAcademicData["paperMetadata"];
  let questions: RetrievedAcademicData["questions"] = [];
  let rawQuestions: Array<{ id: number; questionText: string }> = [];
  let targetPaperId = examId;
  if (!targetPaperId) {
    const papers = await documentRepository.findQuestionPapersByCourse(courseId);
    if (papers && papers.length > 0) targetPaperId = papers[0].id;
  }
  if (targetPaperId) {
    const paper = await documentRepository.findQuestionPaperById(targetPaperId);
    if (paper && paper.courseId === courseId) {
      paperMetadata = { year: paper.year, semester: paper.semester, originalName: paper.originalName };
      const qs = await questionRepository.findByPaperId(paper.id);
      rawQuestions = qs.map((q) => ({ id: q.id, questionText: q.questionText }));
      questions = qs.map((q) => ({
        sequenceNumber: q.sequenceNumber,
        questionText: q.questionText,
        marks: q.marks,
        bloomLevel: q.bloomLevel,
        topic: q.topic,
      }));
    }
  }

  // RAG: the message decides which syllabus passages (and which questions) lead the prompt.
  let syllabusExcerpt = syllabusText;
  let materialPassages: RetrievedAcademicData["materialPassages"] = [];
  let retrieval: RetrievedAcademicData["retrieval"] = {
    method: "FULL_CONTEXT",
    syllabusChunks: 0,
    syllabusChars: syllabusText?.length ?? 0,
    materialChunks: 0,
    relevantQuestions: [],
  };
  if (message.trim()) {
    const selection = await selectRelevantContext(message, courseId, syllabusDoc, rawQuestions);
    if (selection.method === "EMBEDDING") {
      const idToSeq = new Map(questions.map((q, index) => [rawQuestions[index]?.id, q]));
      for (const hit of selection.questionIds) {
        const q = idToSeq.get(hit.id);
        if (q) q.relevance = hit.similarity;
      }
      if (selection.syllabusChunks.length) {
        syllabusExcerpt = selection.syllabusChunks.map((c) => `[§${c.chunkIndex + 1}] ${c.content}`).join("\n…\n");
      }
      materialPassages = selection.materialChunks.map(({ title, kind, locator, content, similarity }) => ({ title, kind, locator, content, similarity }));
      retrieval = {
        method: "EMBEDDING",
        syllabusChunks: selection.syllabusChunks.length,
        syllabusChars: syllabusExcerpt?.length ?? 0,
        materialChunks: materialPassages.length,
        relevantQuestions: selection.questionIds
          .map((hit) => idToSeq.get(hit.id)?.sequenceNumber)
          .filter((n): n is number => n !== undefined),
      };
    } else {
      retrieval.reason = selection.reason;
    }
  }

  // If the conversation is anchored to one specific report (e.g. the Copilot
  // panel embedded in an Analysis Report page), that report always wins over
  // "latest of this type" — the faculty member is asking about THAT report.
  const anchoredReport = reportId ? await reportRepository.findById(reportId) : null;
  if (anchoredReport && anchoredReport.facultyId !== facultyId) {
    throw new AppError("Report not found or access denied", 404);
  }

  async function latestOrAnchored<T>(reportType: string): Promise<T | undefined> {
    if (anchoredReport && anchoredReport.reportType === reportType) {
      return anchoredReport.resultJson as unknown as T;
    }
    const latest = await reportRepository.findLatestByCourseAndType(courseId, reportType as never);
    return latest ? (latest.resultJson as unknown as T) : undefined;
  }

  // Exam Quality Reports
  let examQuality: RetrievedAcademicData["examQuality"];
  if (anchoredReport?.reportType === "EXAM_QUALITY" && anchoredReport.examQualityScore) {
    examQuality = {
      qualityScore: Number(anchoredReport.examQualityScore.qualityScore),
      issues: anchoredReport.examQualityScore.issues as unknown[],
      recommendations: anchoredReport.examQualityScore.recommendations as unknown[],
      positivePoints: anchoredReport.examQualityScore.positivePoints as unknown[],
    };
  } else {
    const latest = await reportRepository.findLatestByCourseAndType(courseId, "EXAM_QUALITY" as never);
    if (latest?.examQualityScore) {
      examQuality = {
        qualityScore: Number(latest.examQualityScore.qualityScore),
        issues: latest.examQualityScore.issues as unknown[],
        recommendations: latest.examQualityScore.recommendations as unknown[],
        positivePoints: latest.examQualityScore.positivePoints as unknown[],
      };
    }
  }

  // CO Intelligence
  const coMapping = await latestOrAnchored<CoMappingResult>("CO_MAPPING");

  // Academic Memory (prefer the dedicated memory engine; fall back to the
  // older pairwise similarity check if that's all this course has)
  const academicMemory = await latestOrAnchored<AcademicMemoryResult>("ACADEMIC_MEMORY");
  const similarity = academicMemory ? undefined : await latestOrAnchored<QuestionSimilarityResult>("QUESTION_SIMILARITY");

  // Question-level clarity review
  const questionReview = await latestOrAnchored<QuestionReviewResult>("QUESTION_REVIEW");

  return {
    course: { courseCode: course.courseCode, courseName: course.courseName },
    courseOutcomes: courseOutcomes.map((co) => ({ code: co.code, description: co.description })),
    syllabusExcerpt,
    paperMetadata,
    questions,
    retrieval,
    materialPassages,
    examQuality,
    coMapping,
    academicMemory,
    similarity,
    questionReview,
  };
}
