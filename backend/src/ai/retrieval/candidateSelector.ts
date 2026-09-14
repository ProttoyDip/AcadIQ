import { env } from "../../config/env";
import { dot, topKNeighbours } from "../embedding/vectorMath";

export interface EmbeddedQuestion {
  id: number;
  text: string;
  vector: Float32Array;
}

export interface CandidatePair<Q extends EmbeddedQuestion = EmbeddedQuestion, P extends EmbeddedQuestion = EmbeddedQuestion> {
  current: Q;
  previous: P;
  /** Cosine similarity in [−1, 1]; reproducible and model-free. */
  vectorSimilarity: number;
}

export interface CandidateSelection<Q extends EmbeddedQuestion, P extends EmbeddedQuestion> {
  pairs: CandidatePair<Q, P>[];
  /** Floor actually applied after adaptive calibration. */
  floor: number;
  configuredFloor: number;
  backgroundP95: number | null;
  topK: number;
  truncated: boolean;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

/**
 * p95 of pairwise cosine among the previous questions themselves. Everything in
 * one course is topically related, so this is the "unrelated same-course" baseline
 * a candidate must clearly exceed. Sampled to keep it O(200²).
 */
export function backgroundSimilarityP95(previous: EmbeddedQuestion[]): number | null {
  if (previous.length < 4) return null;
  const sample = previous.length > 200 ? previous.filter((_, index) => index % Math.ceil(previous.length / 200) === 0) : previous;
  const values: number[] = [];
  for (let i = 0; i < sample.length; i += 1) {
    for (let j = i + 1; j < sample.length; j += 1) {
      values.push(dot(sample[i].vector, sample[j].vector));
    }
  }
  values.sort((a, b) => a - b);
  return percentile(values, 0.95);
}

export function selectCandidatePairs<Q extends EmbeddedQuestion, P extends EmbeddedQuestion>(
  current: Q[],
  previous: P[],
  options: { floor?: number; topK?: number; maxPairs?: number; adaptive?: boolean } = {}
): CandidateSelection<Q, P> {
  const configuredFloor = options.floor ?? env.embedding.similarityFloor;
  const topK = options.topK ?? env.embedding.topK;
  const maxPairs = options.maxPairs ?? env.embedding.maxCandidatePairs;
  const backgroundP95 = options.adaptive === false ? null : backgroundSimilarityP95(previous);
  const floor = backgroundP95 === null ? configuredFloor : Math.max(configuredFloor, backgroundP95);

  const candidates = previous.map((item) => ({ item, vector: item.vector }));
  const pairs: CandidatePair<Q, P>[] = [];
  for (const question of current) {
    for (const neighbour of topKNeighbours(question.vector, candidates, topK, floor)) {
      pairs.push({ current: question, previous: neighbour.item, vectorSimilarity: neighbour.similarity });
    }
  }
  pairs.sort((a, b) => b.vectorSimilarity - a.vectorSimilarity);
  const truncated = pairs.length > maxPairs;
  return { pairs: truncated ? pairs.slice(0, maxPairs) : pairs, floor, configuredFloor, backgroundP95, topK, truncated };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
