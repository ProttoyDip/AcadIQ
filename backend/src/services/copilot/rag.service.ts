import { prisma } from "../../database/prismaClient";
import { embeddingService } from "../../ai/embedding/embeddingService";
import { embeddingRepository } from "../../repositories/embedding.repository";
import { topKNeighbours } from "../../ai/embedding/vectorMath";
import { logger } from "../../utils/logger";
import { MaterialHit, teachingMaterialService } from "../teachingMaterial.service";

const CHUNK_CHARS = 500;
const CHUNK_OVERLAP = 80;
const CHUNK_FLOOR = 0.25;
const QUESTION_FLOOR = 0.3;

export interface RetrievedChunk {
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface RagSelection {
  /** Syllabus passages ranked by cosine to the message; empty when embeddings are unavailable. */
  syllabusChunks: RetrievedChunk[];
  /** Teaching-material passages (slides/notes) ranked by cosine to the message. */
  materialChunks: MaterialHit[];
  /** Question ids ranked by cosine to the message (subset of the paper's questions). */
  questionIds: Array<{ id: number; similarity: number }>;
  method: "EMBEDDING" | "NONE";
  reason?: string;
}

/** Sentence-aware sliding window so a passage never cuts mid-sentence when it can avoid it. */
export function chunkText(text: string, size = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      if (cut > size * 0.5) end = start + cut + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

/** Splits, stores and embeds a syllabus. Idempotent per document; safe to call after upload. */
export async function indexSyllabus(syllabusDocumentId: number, courseId: number, text: string): Promise<number> {
  const existing = await prisma.syllabusChunk.count({ where: { syllabusDocumentId } });
  if (existing === 0) {
    const chunks = chunkText(text);
    if (!chunks.length) return 0;
    await prisma.syllabusChunk.createMany({
      data: chunks.map((content, chunkIndex) => ({ syllabusDocumentId, chunkIndex, content })),
    });
  }
  if (!embeddingService.available) return existing;
  const rows = await prisma.syllabusChunk.findMany({ where: { syllabusDocumentId }, select: { id: true, content: true } });
  await embeddingService.ensureIndexed("SYLLABUS_CHUNK", rows.map((row) => ({ id: row.id, text: row.content, courseId })));
  return rows.length;
}

/**
 * The user's message now decides *what* is retrieved: top-k syllabus passages
 * and top-k questions by cosine, instead of stuffing the whole syllabus and
 * every question into the prompt.
 */
export async function selectRelevantContext(
  message: string,
  courseId: number,
  syllabus: { id: number; extractedText: string | null } | null,
  questions: Array<{ id: number; questionText: string }>,
  limits: { chunks: number; questions: number; materials: number } = { chunks: 6, questions: 10, materials: 5 }
): Promise<RagSelection> {
  if (!embeddingService.available) {
    return { syllabusChunks: [], materialChunks: [], questionIds: [], method: "NONE", reason: embeddingService.unavailableReason ?? "embeddings unavailable" };
  }
  try {
    if (syllabus?.extractedText) await indexSyllabus(syllabus.id, courseId, syllabus.extractedText);
    const [queryVector] = await embeddingService.embed([message]);

    let syllabusChunks: RetrievedChunk[] = [];
    if (syllabus) {
      const rows = await prisma.syllabusChunk.findMany({ where: { syllabusDocumentId: syllabus.id }, select: { id: true, chunkIndex: true, content: true } });
      const vectors = await embeddingRepository.findByOwners("SYLLABUS_CHUNK", rows.map((r) => r.id), embeddingService.model);
      const byId = new Map(vectors.map((v) => [v.ownerId, v.vector]));
      const candidates = rows.flatMap((row) => (byId.has(row.id) ? [{ item: row, vector: byId.get(row.id)! }] : []));
      syllabusChunks = topKNeighbours(queryVector, candidates, limits.chunks, CHUNK_FLOOR)
        .map((n) => ({ chunkIndex: n.item.chunkIndex, content: n.item.content, similarity: Math.round(n.similarity * 1000) / 1000 }))
        .sort((a, b) => a.chunkIndex - b.chunkIndex);
    }

    const questionVectors = await embeddingService.ensureIndexed(
      "QUESTION",
      questions.map((q) => ({ id: q.id, text: q.questionText, courseId }))
    );
    const questionCandidates = questions.flatMap((q) => (questionVectors.has(q.id) ? [{ item: q, vector: questionVectors.get(q.id)! }] : []));
    const questionIds = topKNeighbours(queryVector, questionCandidates, limits.questions, QUESTION_FLOOR)
      .map((n) => ({ id: n.item.id, similarity: Math.round(n.similarity * 1000) / 1000 }));

    const materialChunks = await teachingMaterialService.retrieve(courseId, queryVector, limits.materials, CHUNK_FLOOR);

    return { syllabusChunks, materialChunks, questionIds, method: "EMBEDDING" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn("copilot_rag_fallback", { reason });
    return { syllabusChunks: [], materialChunks: [], questionIds: [], method: "NONE", reason };
  }
}
