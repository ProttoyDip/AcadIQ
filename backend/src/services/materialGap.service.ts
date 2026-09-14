import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { embeddingService } from "../ai/embedding/embeddingService";
import { dot } from "../ai/embedding/vectorMath";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { indexSyllabus } from "./copilot/rag.service";
import { teachingMaterialService } from "./teachingMaterial.service";

const COVERED = 0.6;
const PARTIAL = 0.45;

/**
 * Which parts of the syllabus have no supporting slides/notes? Each syllabus chunk
 * is matched to its nearest teaching-material chunk by cosine; low maxima are gaps.
 * Deterministic given the embeddings — no LLM.
 */
export const materialGapService = {
  async analyze(facultyId: number, courseId: number) {
    const course = await courseRepository.findOwnedById(courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);
    const syllabus = await documentRepository.findLatestSyllabus(courseId);
    if (!syllabus) throw new AppError("Upload a syllabus for this course first", 400);
    const materialCount = await teachingMaterialService.countForCourse(courseId);
    if (!materialCount) throw new AppError("Upload at least one teaching material (slides or notes) first", 400);

    if (!embeddingService.available) {
      return {
        courseId,
        syllabusChunks: 0,
        materials: materialCount,
        covered: 0,
        partial: 0,
        gaps: 0,
        coveragePercent: 0,
        topics: [],
        method: "UNAVAILABLE" as const,
        note: embeddingService.unavailableReason ?? "Embedding model unavailable; gap check needs local embeddings.",
      };
    }

    if (syllabus.extractedText) await indexSyllabus(syllabus.id, courseId, syllabus.extractedText);
    const chunks = await prisma.syllabusChunk.findMany({
      where: { syllabusDocumentId: syllabus.id },
      select: { id: true, chunkIndex: true, content: true },
      orderBy: { chunkIndex: "asc" },
    });
    if (!chunks.length) throw new AppError("The syllabus has no extractable text", 422);
    const syllabusVectors = await embeddingService.ensureIndexed("SYLLABUS_CHUNK", chunks.map((c) => ({ id: c.id, text: c.content, courseId })));

    await teachingMaterialService.ensureIndexedForCourse(courseId);
    const materialChunks = await prisma.teachingMaterialChunk.findMany({
      where: { material: { courseId } },
      select: { id: true, locator: true, material: { select: { id: true, title: true } } },
    });
    const materialVectors = await embeddingService.ensureIndexed(
      "TEACHING_CHUNK",
      (await prisma.teachingMaterialChunk.findMany({ where: { material: { courseId } }, select: { id: true, content: true } })).map((c) => ({ id: c.id, text: c.content, courseId }))
    );
    const materialIndex = materialChunks.flatMap((c) => (materialVectors.has(c.id) ? [{ chunk: c, vector: materialVectors.get(c.id)! }] : []));

    const topics = chunks.map((chunk) => {
      const vector = syllabusVectors.get(chunk.id);
      let best = 0;
      let bestChunk: (typeof materialIndex)[number] | null = null;
      if (vector) {
        for (const candidate of materialIndex) {
          const similarity = dot(vector, candidate.vector);
          if (similarity > best) {
            best = similarity;
            bestChunk = candidate;
          }
        }
      }
      const status = best >= COVERED ? "COVERED" : best >= PARTIAL ? "PARTIAL" : "GAP";
      return {
        chunkIndex: chunk.chunkIndex,
        excerpt: chunk.content.length > 220 ? `${chunk.content.slice(0, 220).trim()}…` : chunk.content,
        bestSimilarity: Math.round(best * 1000) / 1000,
        status: status as "COVERED" | "PARTIAL" | "GAP",
        bestMaterial: bestChunk ? { materialId: bestChunk.chunk.material.id, title: bestChunk.chunk.material.title, locator: bestChunk.chunk.locator } : null,
      };
    });

    const covered = topics.filter((t) => t.status === "COVERED").length;
    const partial = topics.filter((t) => t.status === "PARTIAL").length;
    const gaps = topics.length - covered - partial;
    return {
      courseId,
      syllabusChunks: topics.length,
      materials: materialCount,
      covered,
      partial,
      gaps,
      coveragePercent: Math.round(((covered + partial * 0.5) / topics.length) * 100),
      topics,
      method: "EMBEDDING" as const,
      note: `Each syllabus passage is matched to its closest slide/notes passage (cosine, ${embeddingService.model}). ≥${COVERED} covered, ≥${PARTIAL} partial, below that a gap.`,
    };
  },
};
