import { ollamaService } from "./ollama.service";
import { env } from "../../config/env";
import { normalizeInPlace, dot } from "../../ai/embedding/vectorMath";

export class EmbeddingService {
  public readonly model: string;

  constructor() {
    this.model = env.ollama.embeddingModel;
  }

  /**
   * Generates an L2-normalized embedding for a document chunk.
   */
  async embedDocument(text: string): Promise<Float32Array> {
    const formatted = text.startsWith("search_document:") ? text : `search_document: ${text}`;
    const raw = await ollamaService.getEmbedding(formatted, this.model);
    return normalizeInPlace(raw);
  }

  /**
   * Generates an L2-normalized embedding for a search query.
   */
  async embedQuery(query: string): Promise<Float32Array> {
    const formatted = query.startsWith("search_query:") ? query : `search_query: ${query}`;
    const raw = await ollamaService.getEmbedding(formatted, this.model);
    return normalizeInPlace(raw);
  }

  /**
   * Batch embeds multiple text chunks sequentially or with concurrency.
   */
  async embedMany(chunks: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const chunk of chunks) {
      results.push(await this.embedDocument(chunk));
    }
    return results;
  }

  /**
   * Cosine similarity between two L2-normalized vectors (equivalent to dot product).
   */
  similarity(a: Float32Array, b: Float32Array): number {
    return dot(a, b);
  }

  /**
   * Converts Float32Array to Buffer for database storage.
   */
  vectorToBuffer(vector: Float32Array): Buffer {
    return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
  }

  /**
   * Converts Buffer from database back to Float32Array.
   */
  bufferToVector(buffer: Uint8Array): Float32Array {
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    return new Float32Array(copy.buffer, 0, buffer.byteLength / 4);
  }
}

export const embeddingService = new EmbeddingService();
