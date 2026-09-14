import { prisma } from "../database/prismaClient";
import { embeddingService } from "../ai/embedding/embeddingService";
import { topKNeighbours } from "../ai/embedding/vectorMath";
import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { logger } from "../utils/logger";

export interface NeighbourHit {
  questionId: number;
  questionText: string;
  paperId: number;
  sequenceNumber: number;
  semester: string;
  year: number;
  bloomLevel: string | null;
  topic: string | null;
  cosine: number;
  nearDuplicate: boolean;
}

export interface UploadDuplicateWarning {
  questionId: number;
  sequenceNumber: number;
  matches: Array<Pick<NeighbourHit, "questionId" | "paperId" | "sequenceNumber" | "semester" | "year" | "cosine">>;
}

async function courseQuestionIndex(courseId: number, excludePaperId?: number) {
  const rows = await prisma.question.findMany({
    where: { paper: { courseId, ...(excludePaperId ? { id: { not: excludePaperId } } : {}) } },
    select: {
      id: true, questionText: true, sequenceNumber: true, bloomLevel: true, topic: true,
      paper: { select: { id: true, semester: true, year: true } },
    },
  });
  if (!rows.length) return [];
  const vectors = await embeddingService.ensureIndexed("QUESTION", rows.map((r) => ({ id: r.id, text: r.questionText, courseId })));
  return rows.flatMap((row) => (vectors.has(row.id) ? [{ item: row, vector: vectors.get(row.id)! }] : []));
}

export const questionSearchService = {
  /** "Find questions like this" across a course's whole bank, model-free. */
  async search(facultyId: number, courseId: number, query: string, k = 10, floor = 0.3): Promise<{ hits: NeighbourHit[]; method: "EMBEDDING"; model: string }> {
    const course = await courseRepository.findOwnedById(courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);
    if (!embeddingService.available) throw new AppError(`Semantic search is unavailable: ${embeddingService.unavailableReason}`, 503);
    const [queryVector] = await embeddingService.embed([query]);
    const candidates = await courseQuestionIndex(courseId);
    const hits = topKNeighbours(queryVector, candidates, k, floor).map((n) => ({
      questionId: n.item.id,
      questionText: n.item.questionText,
      paperId: n.item.paper.id,
      sequenceNumber: n.item.sequenceNumber,
      semester: n.item.paper.semester,
      year: n.item.paper.year,
      bloomLevel: n.item.bloomLevel,
      topic: n.item.topic,
      cosine: Math.round(n.similarity * 1000) / 1000,
      nearDuplicate: n.similarity >= env.embedding.nearDuplicate,
    }));
    return { hits, method: "EMBEDDING", model: embeddingService.model };
  },

  /**
   * Upload-time check: each new question against the rest of the course bank.
   * Runs after the upload commits; a failure yields no warnings, never an error.
   */
  async duplicateWarnings(courseId: number, paperId: number): Promise<UploadDuplicateWarning[]> {
    if (!embeddingService.available) return [];
    try {
      const newQuestions = await prisma.question.findMany({
        where: { paperId },
        select: { id: true, questionText: true, sequenceNumber: true },
        orderBy: { sequenceNumber: "asc" },
      });
      const vectors = await embeddingService.ensureIndexed("QUESTION", newQuestions.map((q) => ({ id: q.id, text: q.questionText, courseId })));
      const bank = await courseQuestionIndex(courseId, paperId);
      if (!bank.length) return [];
      const warnings: UploadDuplicateWarning[] = [];
      for (const q of newQuestions) {
        const vector = vectors.get(q.id);
        if (!vector) continue;
        const hits = topKNeighbours(vector, bank, 3, env.embedding.nearDuplicate);
        if (hits.length) {
          warnings.push({
            questionId: q.id,
            sequenceNumber: q.sequenceNumber,
            matches: hits.map((n) => ({
              questionId: n.item.id,
              paperId: n.item.paper.id,
              sequenceNumber: n.item.sequenceNumber,
              semester: n.item.paper.semester,
              year: n.item.paper.year,
              cosine: Math.round(n.similarity * 1000) / 1000,
            })),
          });
        }
      }
      return warnings;
    } catch (error) {
      logger.warn("duplicate_warning_failed", { paperId, reason: error instanceof Error ? error.message : String(error) });
      return [];
    }
  },
};
