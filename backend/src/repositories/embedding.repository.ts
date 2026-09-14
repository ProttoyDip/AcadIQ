import { prisma } from "../database/prismaClient";
import { bufferToVector, vectorToBuffer } from "../ai/embedding/vectorMath";

export type EmbeddingOwnerType = "QUESTION" | "QUESTION_HISTORY" | "SYLLABUS_CHUNK" | "TEACHING_CHUNK" | "COURSE_OUTCOME";

export interface StoredVector {
  ownerId: number;
  courseId: number | null;
  vector: Float32Array;
}

export interface EmbeddingUpsert {
  ownerType: EmbeddingOwnerType;
  ownerId: number;
  courseId: number | null;
  model: string;
  vector: Float32Array;
  contentHash: string;
}

export const embeddingRepository = {
  async findByOwners(ownerType: EmbeddingOwnerType, ownerIds: number[], model: string): Promise<StoredVector[]> {
    if (!ownerIds.length) return [];
    const rows = await prisma.embeddingVector.findMany({
      where: { ownerType, ownerId: { in: ownerIds }, model },
      select: { ownerId: true, courseId: true, vector: true, dimension: true },
    });
    return rows.map((row) => ({
      ownerId: row.ownerId,
      courseId: row.courseId,
      vector: bufferToVector(row.vector, row.dimension),
    }));
  },

  async findByCourse(ownerType: EmbeddingOwnerType, courseId: number, model: string): Promise<StoredVector[]> {
    const rows = await prisma.embeddingVector.findMany({
      where: { ownerType, courseId, model },
      select: { ownerId: true, courseId: true, vector: true, dimension: true },
    });
    return rows.map((row) => ({
      ownerId: row.ownerId,
      courseId: row.courseId,
      vector: bufferToVector(row.vector, row.dimension),
    }));
  },

  async findExistingOwnerIds(ownerType: EmbeddingOwnerType, ownerIds: number[], model: string): Promise<Set<number>> {
    if (!ownerIds.length) return new Set();
    const rows = await prisma.embeddingVector.findMany({
      where: { ownerType, ownerId: { in: ownerIds }, model },
      select: { ownerId: true },
    });
    return new Set(rows.map((row) => row.ownerId));
  },

  async upsertMany(entries: EmbeddingUpsert[]): Promise<Map<number, number>> {
    const ids = new Map<number, number>();
    for (const entry of entries) {
      const row = await prisma.embeddingVector.upsert({
        where: { ownerType_ownerId_model: { ownerType: entry.ownerType, ownerId: entry.ownerId, model: entry.model } },
        create: {
          ownerType: entry.ownerType,
          ownerId: entry.ownerId,
          courseId: entry.courseId,
          model: entry.model,
          dimension: entry.vector.length,
          vector: vectorToBuffer(entry.vector),
          contentHash: entry.contentHash,
        },
        update: {
          courseId: entry.courseId,
          dimension: entry.vector.length,
          vector: vectorToBuffer(entry.vector),
          contentHash: entry.contentHash,
        },
        select: { id: true },
      });
      ids.set(entry.ownerId, row.id);
    }
    return ids;
  },

  /** Gives QuestionHistory.embeddingReference a real job: "<model>#<embeddingVectorId>". */
  async linkQuestionHistory(sourceQuestionIdToVectorId: Map<number, number>, model: string) {
    if (!sourceQuestionIdToVectorId.size) return;
    await prisma.$transaction(
      [...sourceQuestionIdToVectorId.entries()].map(([sourceQuestionId, vectorId]) =>
        prisma.questionHistory.updateMany({
          where: { sourceQuestionId },
          data: { embeddingReference: `${model}#${vectorId}` },
        })
      )
    );
  },

  countByCourse(ownerType: EmbeddingOwnerType, courseId: number, model: string) {
    return prisma.embeddingVector.count({ where: { ownerType, courseId, model } });
  },
};
