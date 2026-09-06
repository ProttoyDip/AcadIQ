import {
  BloomDistribution,
  CoMappingResult,
  ExamQualityResult,
  QuestionSimilarityResult,
} from "../types";

/**
 * AcadIQ never shows a bare AI number — every derived value here feeds an
 * ExplainableAIInsightCard with a confidence and a reason. None of these are
 * returned by the backend as an explicit "confidence" field; they're honest,
 * documented heuristics computed from the same structured data the AI already
 * produced (strength grades, clarity scores, similarity percentages), not
 * invented numbers.
 */

export function confidenceForCoStrength(strength: "WEAK" | "MODERATE" | "STRONG"): number {
  return { STRONG: 92, MODERATE: 68, WEAK: 40 }[strength];
}

export function confidenceFromClarity(clarityScore: number): number {
  return Math.max(30, Math.min(97, Math.round(clarityScore)));
}

/** Similarity score doubles as the model's own confidence in the match. */
export function confidenceFromSimilarity(similarityPercentage: number): number {
  return Math.round(similarityPercentage);
}

/** More data points behind a distribution -> higher confidence in the read. */
export function confidenceFromSampleSize(questionCount: number): number {
  if (questionCount >= 15) return 90;
  if (questionCount >= 8) return 75;
  if (questionCount >= 4) return 55;
  return 35;
}

export type DifficultyBucket = "Easy" | "Medium" | "Hard";

const DIFFICULTY_BUCKET: Record<string, DifficultyBucket> = {
  REMEMBER: "Easy",
  UNDERSTAND: "Easy",
  APPLY: "Medium",
  ANALYZE: "Medium",
  EVALUATE: "Hard",
  CREATE: "Hard",
};

export function difficultyBucketFor(bloomLevel: string): DifficultyBucket {
  return DIFFICULTY_BUCKET[bloomLevel] ?? "Medium";
}

export function difficultyBucketBreakdown(distribution: BloomDistribution[]) {
  const buckets: Record<DifficultyBucket, number> = { Easy: 0, Medium: 0, Hard: 0 };
  for (const d of distribution) {
    buckets[difficultyBucketFor(d.level)] += d.percentage;
  }
  return buckets;
}

export interface ScoreFactor {
  label: string;
  positive: boolean;
}

/**
 * Produces the plain-language "why this score" factors shown under the score
 * hero — real thresholds applied to real report data (topic coverage, Bloom
 * balance, CO coverage, prior-paper similarity), not a black box.
 */
export function deriveScoreFactors(
  result: ExamQualityResult,
  coMapping?: CoMappingResult,
  similarity?: QuestionSimilarityResult
): ScoreFactor[] {
  const factors: ScoreFactor[] = [];

  const topicsTotal = result.topicCoverage.length;
  const topicsCovered = result.topicCoverage.filter((t) => t.coveredInExam).length;
  const coveragePct = topicsTotal > 0 ? (topicsCovered / topicsTotal) * 100 : 0;
  if (topicsTotal > 0) {
    factors.push(
      coveragePct >= 80
        ? { label: `Good topic coverage (${topicsCovered}/${topicsTotal} syllabus topics)`, positive: true }
        : { label: `${topicsTotal - topicsCovered} syllabus topic(s) not covered by this exam`, positive: false }
    );
  }

  const buckets = difficultyBucketBreakdown(result.bloomDistribution);
  if (buckets.Easy > 55) {
    factors.push({ label: "Too many recall-based (Easy) questions", positive: false });
  } else if (buckets.Easy <= 45 && buckets.Hard >= 10) {
    factors.push({ label: "Balanced difficulty across cognitive levels", positive: true });
  }

  const outcomes = coMapping
    ? Object.entries(coMapping.coverage).map(([outcome, percentage]) => ({ outcome, percentage }))
    : result.learningOutcomeAlignment.map((o) => ({ outcome: o.outcome, percentage: o.addressed ? 100 : 0 }));

  const weakOutcomes = outcomes.filter((o) => o.percentage < 50);
  if (outcomes.length > 0) {
    if (weakOutcomes.length === 0) {
      factors.push({ label: "All course outcomes reasonably addressed", positive: true });
    } else {
      weakOutcomes.slice(0, 2).forEach((o) => {
        factors.push({ label: `${o.outcome} underrepresented (${Math.round(o.percentage)}%)`, positive: false });
      });
    }
  }

  if (similarity) {
    if (similarity.overallDuplicationPercentage <= 20) {
      factors.push({ label: "Low overlap with previous exams", positive: true });
    } else if (similarity.overallDuplicationPercentage > 40) {
      factors.push({ label: "High overlap with a previous exam paper", positive: false });
    }
  }

  const highPriority = result.recommendations.filter((r) => r.priority === "HIGH").length;
  if (highPriority === 0) {
    factors.push({ label: "No high-priority issues flagged", positive: true });
  } else {
    factors.push({ label: `${highPriority} high-priority recommendation(s) need attention`, positive: false });
  }

  return factors;
}
