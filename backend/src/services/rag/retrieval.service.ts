import { prisma } from "../../database/prismaClient";
import { embeddingService } from "../ollama/embedding.service";
import { AppError } from "../../middleware/error.middleware";

export interface RetrievedChunkResult {
  id: number;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  section: string | null;
  similarity: number;
}

export interface RetrievalOptions {
  topK?: number; // default: 5
  similarityFloor?: number; // default: 0.35
}

export class RetrievalService {
  /**
   * Retrieves relevant chunks from a document using vector cosine similarity.
   */
  async retrieveChunks(
    documentId: number,
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievedChunkResult[]> {
    const topK = options.topK ?? 5;
    const similarityFloor = options.similarityFloor ?? 0.35;

    // Fetch chunks with embeddings from database
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      select: {
        id: true,
        chunkIndex: true,
        content: true,
        pageNumber: true,
        section: true,
        embedding: true,
      },
    });

    if (!chunks.length) {
      return [];
    }

    // Embed the search query with nomic-embed-text
    let queryVector: Float32Array;
    try {
      queryVector = await embeddingService.embedQuery(query);
    } catch (error: any) {
      throw new AppError(`Failed to generate embedding for query: ${error.message}`, 502);
    }

    const scoredChunks: RetrievedChunkResult[] = [];

    for (const chunk of chunks) {
      if (!chunk.embedding) continue;

      try {
        const chunkVector = embeddingService.bufferToVector(chunk.embedding);
        const score = embeddingService.similarity(queryVector, chunkVector);

        if (score >= similarityFloor) {
          scoredChunks.push({
            id: chunk.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            section: chunk.section,
            similarity: Math.round(score * 1000) / 1000,
          });
        }
      } catch {
        // Skip unparseable embedding row
      }
    }

    // Sort descending by similarity
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    return scoredChunks.slice(0, topK);
  }
}

export const retrievalService = new RetrievalService();
