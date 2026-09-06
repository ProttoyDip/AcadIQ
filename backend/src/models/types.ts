// Domain-level types for validated AI results stored in AnalysisReport.resultJson.

export type PriorityValue = "LOW" | "MEDIUM" | "HIGH";

export type BloomLevel =
  | "REMEMBER"
  | "UNDERSTAND"
  | "APPLY"
  | "ANALYZE"
  | "EVALUATE"
  | "CREATE";

export interface AIExplanationResult {
  decision: string;
  reason: string;
  confidence: number;
}

export interface RecommendationResult {
  message: string;
  priority: PriorityValue;
}

export interface IssueResult {
  severity: PriorityValue;
  message: string;
  reason: string;
}

export interface TopicCoverage {
  topic: string;
  coveredInExam: boolean;
  questionCount: number;
  marksAllocated: number;
  reason: string;
}

export interface BloomDistribution {
  level: BloomLevel;
  questionCount: number;
  marksAllocated: number;
  percentage: number;
  reason: string;
}

export interface ExamQualityResult {
  qualityScore: number;
  coverage: {
    percentage: number;
    topics: TopicCoverage[];
    courseOutcomes: Array<{ outcome: string; addressed: boolean; reason: string }>;
  };
  difficulty: Array<{
    level: "EASY" | "MODERATE" | "HARD";
    questionCount: number;
    marksAllocated: number;
    percentage: number;
    reason: string;
  }>;
  bloomDistribution: BloomDistribution[];
  marksDistribution: Array<{ topic: string; marks: number; percentage: number }>;
  scoreFactors: Array<{ factor: string; score: number; weight: number; reason: string }>;
  positivePoints: string[];
  issues: IssueResult[];
  recommendations: RecommendationResult[];
  explanation: AIExplanationResult;
}

export interface SyllabusCoverageResult {
  coveredTopics: string[];
  missingTopics: string[];
  overusedTopics: { topic: string; occurrences: number }[];
  coveragePercentage: number;
  explanation: AIExplanationResult;
}

export interface SimilarityMatch {
  currentQuestionId: number;
  previousQuestionId: number;
  similarityPercentage: number;
  matchType: "DUPLICATE" | "SIMILAR_CONCEPT" | "REPEATED_PATTERN";
  reason: string;
  confidence: number;
}

export interface QuestionSimilarityResult {
  matches: SimilarityMatch[];
  overallDuplicationPercentage: number;
  recommendation: string;
  explanation: AIExplanationResult;
}

export interface AcademicMemoryResult {
  similarQuestions: Array<{
    newQuestionId: number;
    historicalQuestionId: number;
    similarityScore: number;
    reason: string;
    confidence: number;
    replacementSuggestion: string;
  }>;
  similarityScore: number;
  replacementSuggestion: string;
  explanation: AIExplanationResult;
}

export interface QuestionReviewResult {
  qualityScore: number;
  questions: Array<{
    questionId: number;
    clarityScore: number;
    bloomLevel: BloomLevel;
    issues: string[];
    suggestedRewrite?: string;
  }>;
  issues: Array<{ severity: PriorityValue; message: string; questionId?: number }>;
  recommendations: RecommendationResult[];
  explanation: AIExplanationResult;
}

export interface CoMappingResult {
  qualityScore: number;
  courseOutcomes: Array<{ code: string; description: string }>;
  questionCOMap: Array<{
    questionId: number;
    courseOutcome: string;
    strength: "WEAK" | "MODERATE" | "STRONG";
    decision: string;
    reason: string;
    confidence: number;
  }>;
  coverage: Record<string, number>;
  coveragePercentage: number;
  missingOutcomes: string[];
  unmappedQuestionIds: number[];
  issues: Array<{ severity: PriorityValue; message: string }>;
  recommendations: RecommendationResult[];
  explanation: AIExplanationResult;
}
