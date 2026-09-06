// Domain-level types shared across services/repositories.
// Prisma generates the persistence models; these describe AI/report shapes
// that live inside the `result_json` JSON column and aren't first-class tables.

export type BloomLevel =
  | "REMEMBER"
  | "UNDERSTAND"
  | "APPLY"
  | "ANALYZE"
  | "EVALUATE"
  | "CREATE";

export interface TopicCoverage {
  topic: string;
  coveredInExam: boolean;
  questionCount: number;
  marksAllocated: number;
}

export interface BloomDistribution {
  level: BloomLevel;
  questionCount: number;
  marksAllocated: number;
  percentage: number;
}

export interface ExamQualityResult {
  overallScore: number; // 0-100
  topicCoverage: TopicCoverage[];
  bloomDistribution: BloomDistribution[];
  marksDistribution: { topic: string; marks: number; percentage: number }[];
  learningOutcomeAlignment: { outcome: string; addressed: boolean }[];
  recommendations: { message: string; priority: "LOW" | "MEDIUM" | "HIGH" }[];
}

export interface SyllabusCoverageResult {
  coveredTopics: string[];
  missingTopics: string[];
  overusedTopics: { topic: string; occurrences: number }[];
  coveragePercentage: number;
}

export interface SimilarityMatch {
  currentQuestionId: number;
  previousQuestionId: number;
  similarityPercentage: number;
  matchType: "DUPLICATE" | "SIMILAR_CONCEPT" | "REPEATED_PATTERN";
}

export interface QuestionSimilarityResult {
  matches: SimilarityMatch[];
  overallDuplicationPercentage: number;
  recommendation: string;
}
