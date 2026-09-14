// Domain-level types for validated AI results stored in AnalysisReport.resultJson.

export type PriorityValue = "LOW" | "MEDIUM" | "HIGH";

export type BloomLevel =
  | "REMEMBER"
  | "UNDERSTAND"
  | "APPLY"
  | "ANALYZE"
  | "EVALUATE"
  | "CREATE";

/** Points each evidence source contributed to evidenceSufficiency (weights 30/25/20/15/10). */
export interface EvidenceBreakdown {
  documentCompleteness: number;
  questionSample: number;
  syllabus: number;
  courseOutcomes: number;
  history: number;
}

/**
 * Reliability contract v2. `confidence` is kept for backwards compatibility and
 * is defined as min(evidenceSufficiency, modelAgreement ?? evidenceSufficiency),
 * so it is never higher than the v1 value. Reports without `reliabilityVersion`
 * are v1: their `confidence` was input-completeness only.
 */
export interface AIExplanationResult {
  decision: string;
  reason: string;
  confidence: number;
  /** 0-100 reproducible input-completeness score (formerly mislabelled "confidence"). */
  evidenceSufficiency?: number;
  evidenceBreakdown?: EvidenceBreakdown;
  /** 0-100 stability across k samples; NULL when k = 1. Measures answer stability, not correctness. */
  modelAgreement?: number | null;
  sampleCount?: number;
  /** How agreement was measured; cross-model disagreement is the stronger signal. */
  agreementMode?: "self-consistency" | "cross-model";
  agreementModels?: string[];
  /** Model-free retrieval signal (similarity only): best embedding cosine, 0-100. */
  retrievalSupport?: number | null;
  reliabilityNote?: string;
  reliabilityVersion?: 2;
}

/** Per-item reliability, replacing the report-level constant that used to be copied onto every match. */
export interface ItemReliability {
  votes?: string;
  modelAgreement?: number | null;
  evidenceSufficiency?: number;
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
  /** max − min of qualityScore across samples; undefined when k = 1. */
  qualityScoreSpread?: number;
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

export interface SimilarityMatch extends ItemReliability {
  currentQuestionId: number;
  previousQuestionId: number;
  similarityPercentage: number;
  matchType: "DUPLICATE" | "SIMILAR_CONCEPT" | "REPEATED_PATTERN";
  reason: string;
  confidence: number;
  /** Cosine similarity from the local embedding model (0-1); reproducible and model-free. */
  vectorSimilarity?: number;
  source?: "EMBEDDING+LLM" | "LLM_ONLY";
  /** Present when a candidate was confirmed by some samples but not a majority. */
  contested?: boolean;
}

/** How candidate pairs were retrieved before the LLM explained them. */
export interface RetrievalProvenance {
  method: "EMBEDDING+LLM" | "LLM_ONLY";
  embeddingModel: string | null;
  similarityFloor: number | null;
  configuredFloor: number | null;
  backgroundP95: number | null;
  nearDuplicateThreshold: number | null;
  topK: number | null;
  candidatePairs: number;
  rejectedPairs: number;
  llmCalls: number;
  truncated: boolean;
  fallbackReason?: string;
}

export interface QuestionSimilarityResult {
  matches: SimilarityMatch[];
  overallDuplicationPercentage: number;
  recommendation: string;
  explanation: AIExplanationResult;
  retrieval?: RetrievalProvenance;
}

export interface AcademicMemoryResult {
  similarQuestions: Array<ItemReliability & {
    newQuestionId: number;
    historicalQuestionId: number;
    similarityScore: number;
    reason: string;
    confidence: number;
    replacementSuggestion: string;
    vectorSimilarity?: number;
    source?: "EMBEDDING+LLM" | "LLM_ONLY";
  }>;
  similarityScore: number;
  replacementSuggestion: string;
  explanation: AIExplanationResult;
  retrieval?: RetrievalProvenance;
}

export interface QuestionReviewResult {
  qualityScore: number;
  questions: Array<{
    questionId: number;
    clarityScore: number;
    bloomLevel: BloomLevel;
    decision: string;
    reason: string;
    confidence: number;
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
  questionCOMap: Array<ItemReliability & {
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
