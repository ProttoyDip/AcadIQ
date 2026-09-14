import { createHash } from "node:crypto";

export const EMBEDDING_DIMENSION = 384;

/** Serialises a Float32 vector as little-endian bytes for the LONGBLOB column. */
export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

/**
 * Prisma Buffers can sit at a non-4-byte-aligned offset inside Node's slab pool,
 * so a zero-copy Float32Array view throws intermittently. Always copy.
 */
export function bufferToVector(buffer: Uint8Array, dimension: number): Float32Array {
  if (buffer.byteLength !== dimension * 4) {
    throw new Error(`Embedding byte length ${buffer.byteLength} does not match dimension ${dimension}`);
  }
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return new Float32Array(copy.buffer, 0, dimension);
}

/** Vectors are L2-normalised at write time, so cosine similarity is a plain dot product. */
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

export function normalizeInPlace(vector: Float32Array): Float32Array {
  const norm = Math.sqrt(dot(vector, vector));
  if (norm > 0) for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
}

/** Stable hash of the exact text that was embedded, used to skip unchanged rows. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text.normalize("NFC")).digest("hex");
}

export function normalizeForEmbedding(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 2_000);
}

export interface ScoredNeighbour<T> {
  item: T;
  similarity: number;
}

/** Brute-force top-k over a candidate list; fine up to tens of thousands per course. */
export function topKNeighbours<T>(
  query: Float32Array,
  candidates: Array<{ item: T; vector: Float32Array }>,
  k: number,
  floor: number
): ScoredNeighbour<T>[] {
  const scored: ScoredNeighbour<T>[] = [];
  for (const candidate of candidates) {
    const similarity = dot(query, candidate.vector);
    if (similarity >= floor) scored.push({ item: candidate.item, similarity });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
