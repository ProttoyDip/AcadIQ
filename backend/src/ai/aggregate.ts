/**
 * Aggregation primitives for self-consistency samples. Rules:
 *   numeric     → median, spread = (max − min) normalised to the scale
 *   categorical → modal label, agreement = mode / k
 *   set-valued  → per-item vote support; keep ≥ majority, flag minority-but-present as contested
 *   free text   → NEVER averaged; callers take prose from the sample matching the consensus
 * Vocabulary (`variance_percentage`, `has_high_discrepancy`) mirrors dualEvaluation.service.ts
 * so the UI has one language for disagreement.
 */

export interface AgreementSummary {
  /** Number of samples that produced this consensus. null/1 means no agreement can be claimed. */
  sampleCount: number;
  /** 0-100 stability of the answer across samples. NOT accuracy. */
  agreement: number;
  /** Numeric spread of the headline metric on its own scale, when it has one. */
  spread?: number;
  variance_percentage?: number;
  has_high_discrepancy: boolean;
  /** Item key → "confirmed/k" for set-valued outputs. */
  votes?: Record<string, string>;
  /** Item keys that appeared in some but not a majority of samples. */
  contested?: string[];
  /** Jaccard similarity across sample sets for set-valued outputs. */
  jaccard?: number;
}

export const HIGH_DISCREPANCY_THRESHOLD = 25;

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregateNumeric(values: number[], scale = 100): { consensus: number; agreement: AgreementSummary; consensusIndex: number } {
  const med = median(values);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const variance = scale > 0 ? (spread / scale) * 100 : 0;
  // Index of the sample closest to the median: its prose becomes the consensus prose.
  let consensusIndex = 0;
  values.forEach((value, index) => {
    if (Math.abs(value - med) < Math.abs(values[consensusIndex] - med)) consensusIndex = index;
  });
  return {
    consensus: med,
    consensusIndex,
    agreement: {
      sampleCount: values.length,
      agreement: Math.round(Math.max(0, 100 - variance)),
      spread,
      variance_percentage: Math.round(variance * 10) / 10,
      has_high_discrepancy: variance >= HIGH_DISCREPANCY_THRESHOLD,
    },
  };
}

export function mode<T extends string>(values: T[]): { label: T; support: number } {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T = values[0];
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return { label: best, support: bestCount };
}

/**
 * Per-item categorical vote (e.g. questionId → bloomLevel across k samples).
 * Returns the modal label per item and the mean support fraction.
 */
export function aggregateLabels<T extends string>(
  samples: Array<Record<string, T>>
): { consensus: Record<string, T>; agreement: AgreementSummary } {
  const k = samples.length;
  const keys = new Set(samples.flatMap((sample) => Object.keys(sample)));
  const consensus: Record<string, T> = {};
  const votes: Record<string, string> = {};
  const contested: string[] = [];
  let supportSum = 0;
  for (const key of keys) {
    const labels = samples.map((sample) => sample[key]).filter((label): label is T => label !== undefined);
    const { label, support } = mode(labels);
    consensus[key] = label;
    votes[key] = `${support}/${k}`;
    supportSum += support / k;
    if (support < k) contested.push(key);
  }
  const agreement = keys.size ? Math.round((supportSum / keys.size) * 100) : 100;
  return {
    consensus,
    agreement: {
      sampleCount: k,
      agreement,
      variance_percentage: 100 - agreement,
      has_high_discrepancy: 100 - agreement >= HIGH_DISCREPANCY_THRESHOLD,
      votes,
      contested,
    },
  };
}

/**
 * Set-valued vote (e.g. which candidate pairs were confirmed). Items present in a
 * strict majority of samples are kept; items in ≥1 but < majority are contested.
 */
export function aggregateSets(sampleSets: Array<Set<string>>): {
  kept: Set<string>;
  agreement: AgreementSummary;
} {
  const k = sampleSets.length;
  const counts = new Map<string, number>();
  for (const set of sampleSets) for (const item of set) counts.set(item, (counts.get(item) ?? 0) + 1);
  const majority = Math.floor(k / 2) + 1;
  const kept = new Set<string>();
  const contested: string[] = [];
  const votes: Record<string, string> = {};
  for (const [item, count] of counts) {
    votes[item] = `${count}/${k}`;
    if (count >= majority) kept.add(item);
    else contested.push(item);
  }
  const union = counts.size;
  const intersection = [...counts.values()].filter((count) => count === k).length;
  const jaccard = union ? intersection / union : 1;
  // Per item: share of samples that agreed with the final keep/drop decision, averaged.
  const decisionSupport = [...counts.entries()].reduce(
    (sum, [item, count]) => sum + (kept.has(item) ? count : k - count) / k,
    0
  );
  const agreement = union === 0 ? 100 : Math.round((decisionSupport / union) * 100);
  return {
    kept,
    agreement: {
      sampleCount: k,
      agreement,
      variance_percentage: Math.round((1 - jaccard) * 1000) / 10,
      has_high_discrepancy: (1 - jaccard) * 100 >= HIGH_DISCREPANCY_THRESHOLD,
      votes,
      contested,
      jaccard: Math.round(jaccard * 1000) / 1000,
    },
  };
}
