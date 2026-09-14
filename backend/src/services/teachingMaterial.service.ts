import { promises as fs } from "node:fs";
import { z } from "zod";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { extractDocumentText } from "../ai/documentTextExtractor";
import { embeddingService } from "../ai/embedding/embeddingService";
import { embeddingRepository } from "../repositories/embedding.repository";
import { topKNeighbours } from "../ai/embedding/vectorMath";
import { courseRepository } from "../repositories/course.repository";
import { UploadedDocument } from "../validators/document.validator";
import { auditService } from "./audit.service";
import { chunkText } from "./copilot/rag.service";
import { logger } from "../utils/logger";

export const materialUploadSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(["SLIDES", "NOTES", "HANDOUT", "OTHER"]).optional(),
});

export interface MaterialHit {
  materialId: number;
  title: string;
  kind: string;
  locator: string | null;
  content: string;
  similarity: number;
}

function inferKind(originalName: string, mimeType: string): "SLIDES" | "NOTES" | "HANDOUT" | "OTHER" {
  const lower = originalName.toLowerCase();
  if (lower.endsWith(".pptx") || mimeType.includes("presentation")) return "SLIDES";
  if (lower.endsWith(".md") || lower.endsWith(".txt") || /note|summary/.test(lower)) return "NOTES";
  if (/handout|worksheet|tutorial|lab|assignment/.test(lower)) return "HANDOUT";
  if (/slide|lecture|deck/.test(lower)) return "SLIDES";
  return "OTHER";
}

/** "Slide 12" markers written by the PPTX extractor become chunk locators so answers can cite the slide. */
function locatorFor(chunk: string): string | null {
  const match = chunk.match(/\bSlide (\d+)\b/);
  return match ? `Slide ${match[1]}` : null;
}

export const teachingMaterialService = {
  async upload(facultyId: number, input: z.infer<typeof materialUploadSchema>, file: UploadedDocument) {
    const course = await courseRepository.findOwnedById(input.courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);
    const extractedText = await extractDocumentText(file.path, file.mimetype);
    const kind = input.kind ?? inferKind(file.originalname, file.mimetype);
    const title = input.title ?? file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200);

    const chunks = chunkText(extractedText, 600, 80);
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.teachingMaterial.create({
        data: {
          courseId: input.courseId,
          title,
          originalName: file.originalname,
          filePath: file.path,
          mimeType: file.mimetype,
          fileSize: file.size,
          kind,
          extractedText,
          chunkCount: chunks.length,
        },
      });
      if (chunks.length) {
        await tx.teachingMaterialChunk.createMany({
          data: chunks.map((content, chunkIndex) => ({ materialId: created.id, chunkIndex, locator: locatorFor(content), content })),
        });
      }
      return created;
    });
    await auditService.recordAuditLog({ userId: facultyId, action: "Faculty uploaded teaching material", document: file.originalname });

    // Embeddings outside the transaction; a failure just means lazy indexing later.
    if (embeddingService.available && chunks.length) {
      try {
        const rows = await prisma.teachingMaterialChunk.findMany({ where: { materialId: material.id }, select: { id: true, content: true } });
        await embeddingService.ensureIndexed("TEACHING_CHUNK", rows.map((row) => ({ id: row.id, text: row.content, courseId: input.courseId })));
      } catch (error) {
        logger.warn("material_index_failed", { materialId: material.id, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    const { filePath: _internal, extractedText: _text, ...publicMaterial } = material;
    return { ...publicMaterial, textChars: extractedText.length };
  },

  async list(facultyId: number, courseId: number) {
    const course = await courseRepository.findOwnedById(courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);
    return prisma.teachingMaterial.findMany({
      where: { courseId },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, title: true, originalName: true, mimeType: true, fileSize: true, kind: true, chunkCount: true, uploadedAt: true },
    });
  },

  async remove(facultyId: number, materialId: number) {
    const material = await prisma.teachingMaterial.findUnique({ where: { id: materialId }, include: { course: { select: { facultyId: true } }, chunks: { select: { id: true } } } });
    if (!material || material.course.facultyId !== facultyId) throw new AppError("Material not found", 404);
    await prisma.embeddingVector.deleteMany({ where: { ownerType: "TEACHING_CHUNK", ownerId: { in: material.chunks.map((c) => c.id) } } });
    await prisma.teachingMaterial.delete({ where: { id: materialId } });
    await fs.unlink(material.filePath).catch(() => undefined);
    return { id: materialId };
  },

  async countForCourse(courseId: number) {
    return prisma.teachingMaterial.count({ where: { courseId } });
  },

  /** Top-k material passages by cosine to a query (Copilot turn, similarity check, etc.). */
  async retrieve(courseId: number, queryVector: Float32Array, k = 6, floor = 0.25): Promise<MaterialHit[]> {
    const rows = await prisma.teachingMaterialChunk.findMany({
      where: { material: { courseId } },
      select: { id: true, locator: true, content: true, material: { select: { id: true, title: true, kind: true } } },
    });
    if (!rows.length) return [];
    const vectors = await embeddingService.ensureIndexed("TEACHING_CHUNK", rows.map((r) => ({ id: r.id, text: r.content, courseId })));
    const candidates = rows.flatMap((row) => (vectors.has(row.id) ? [{ item: row, vector: vectors.get(row.id)! }] : []));
    return topKNeighbours(queryVector, candidates, k, floor).map((n) => ({
      materialId: n.item.material.id,
      title: n.item.material.title,
      kind: n.item.material.kind,
      locator: n.item.locator,
      content: n.item.content,
      similarity: Math.round(n.similarity * 1000) / 1000,
    }));
  },

  /**
   * Query-free sample for the paper generator: spreads a character budget evenly
   * across every material so each deck/lecture contributes, rather than the
   * first file consuming the whole budget.
   */
  async excerptForGeneration(courseId: number, budgetChars: number, materialIds?: number[]): Promise<{ text: string; materials: number; chunks: number }> {
    const materials = await prisma.teachingMaterial.findMany({
      where: { courseId, ...(materialIds?.length ? { id: { in: materialIds } } : {}) },
      select: { id: true, title: true, kind: true, chunks: { select: { locator: true, content: true }, orderBy: { chunkIndex: "asc" } } },
      orderBy: { uploadedAt: "asc" },
    });
    if (!materials.length) return { text: "", materials: 0, chunks: 0 };
    const perMaterial = Math.floor(budgetChars / materials.length);
    const parts: string[] = [];
    let used = 0;
    for (const material of materials) {
      if (!material.chunks.length) continue;
      const step = Math.max(1, Math.ceil(material.chunks.reduce((s, c) => s + c.content.length, 0) / Math.max(perMaterial, 1)));
      const sampled = material.chunks.filter((_, index) => index % step === 0);
      let text = `## ${material.title} (${material.kind.toLowerCase()})\n`;
      for (const chunk of sampled) {
        const piece = `${chunk.locator ? `[${chunk.locator}] ` : ""}${chunk.content}\n`;
        if (text.length + piece.length > perMaterial) break;
        text += piece;
        used += 1;
      }
      parts.push(text.trim());
    }
    return { text: parts.join("\n\n"), materials: materials.length, chunks: used };
  },

  /** Ensures every chunk of every material in a course has a vector (used by the embedding backfill). */
  async ensureIndexedForCourse(courseId: number) {
    const rows = await prisma.teachingMaterialChunk.findMany({ where: { material: { courseId } }, select: { id: true, content: true } });
    const existing = await embeddingRepository.findExistingOwnerIds("TEACHING_CHUNK", rows.map((r) => r.id), embeddingService.model);
    const missing = rows.filter((r) => !existing.has(r.id));
    if (missing.length) await embeddingService.ensureIndexed("TEACHING_CHUNK", missing.map((r) => ({ id: r.id, text: r.content, courseId })));
    return missing.length;
  },
};
