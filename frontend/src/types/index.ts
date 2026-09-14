export interface Course {
  id: number;
  facultyId: number;
  courseCode: string;
  courseName: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
  syllabusDocuments?: SyllabusDocument[];
  questionPapers?: QuestionPaper[];
}

export interface SyllabusDocument {
  id: number;
  courseId: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface QuestionPaper {
  id: number;
  courseId: number;
  year: number;
  semester: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  questions?: Question[];
}

export interface Question {
  id: number;
  paperId: number;
  sequenceNumber: number;
  questionText: string;
  marks: number;
  topic?: string | null;
  bloomLevel?: string | null;
}

export type BloomLevel = "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface EvidenceBreakdown {
  documentCompleteness: number;
  questionSample: number;
  syllabus: number;
  courseOutcomes: number;
  history: number;
}

/**
 * Reliability v2: `confidence` = min(evidenceSufficiency, modelAgreement ?? evidenceSufficiency).
 * `modelAgreement` is null for single runs and measures answer stability, never accuracy.
 * Reports without `reliabilityVersion` are v1 (confidence = input completeness only).
 */
export interface AIExplanation {
  decision: string;
  reason: string;
  confidence: number;
  evidenceSufficiency?: number;
  evidenceBreakdown?: EvidenceBreakdown;
  modelAgreement?: number | null;
  sampleCount?: number;
  retrievalSupport?: number | null;
  reliabilityNote?: string;
  reliabilityVersion?: 2;
}

export type ReliabilityMode = "fast" | "verified";

interface ExplainableResult extends AIExplanation {
  explanation: AIExplanation;
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
}

export interface Recommendation {
  id?: number;
  message: string;
  priority: Priority;
}

export interface ExamQualityResult extends ExplainableResult {
  reportId: number;
  overallScore: number;
  topicCoverage: TopicCoverage[];
  bloomDistribution: BloomDistribution[];
  marksDistribution: { topic: string; marks: number; percentage: number }[];
  learningOutcomeAlignment: { outcome: string; addressed: boolean }[];
  recommendations: Recommendation[];
}

export interface SyllabusCoverageResult extends ExplainableResult {
  reportId: number;
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
  reason: string;
  confidence: number;
  /** Cosine similarity (0-1) from the local embedding model; reproducible, model-free. */
  vectorSimilarity?: number;
  source?: "EMBEDDING+LLM" | "LLM_ONLY";
  /** "2/3" style vote when the report was run with reliability=verified. */
  votes?: string;
  contested?: boolean;
  modelAgreement?: number | null;
  evidenceSufficiency?: number;
}

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

export interface QuestionSimilarityResult extends ExplainableResult {
  reportId: number;
  matches: SimilarityMatch[];
  overallDuplicationPercentage: number;
  recommendation: string;
  retrieval?: RetrievalProvenance;
}

export type CoMappingStrength = "WEAK" | "MODERATE" | "STRONG";

export interface CoMapping {
  questionId: number;
  courseOutcome: string;
  strength: CoMappingStrength;
  decision: string;
  rationale: string;
  reason: string;
  confidence: number;
}

export interface Issue {
  severity: Priority;
  message: string;
  questionId?: number;
}

export interface CoMappingResult extends ExplainableResult {
  reportId: number;
  qualityScore: number;
  coverage: Record<string, number>;
  mappings: CoMapping[];
  unmappedQuestionIds: number[];
  issues: Issue[];
  recommendations: Recommendation[];
}

export interface QuestionReviewItem {
  questionId: number;
  clarityScore: number;
  bloomLevel: BloomLevel;
  topic?: string;
  bloomVotes?: string;
  bloomContested?: boolean;
  decision: string;
  reason: string;
  confidence: number;
  issues: string[];
  suggestedRewrite?: string;
}

export interface QuestionReviewResult extends ExplainableResult {
  reportId: number;
  qualityScore: number;
  questions: QuestionReviewItem[];
  issues: Issue[];
  recommendations: Recommendation[];
}

export type ReportType =
  | "EXAM_QUALITY"
  | "SYLLABUS_COVERAGE"
  | "QUESTION_SIMILARITY"
  | "QUESTION_REVIEW"
  | "CO_MAPPING"
  | "ACADEMIC_MEMORY"
  | "GENERATED_PAPER";

export interface QuestionFeedback {
  id: number;
  questionId: number;
  reportId: number | null;
  verdict: "UP" | "DOWN";
  aiBloomLevel: string | null;
  correctedBloomLevel: string | null;
  aiTopic: string | null;
  correctedTopic: string | null;
  note: string | null;
  createdAt: string;
}

export interface FeedbackStats {
  total: number;
  thumbsUp: number;
  thumbsDown: number;
  bloomCorrections: number;
  bloomAgreementPercent: number | null;
  cohensKappa: number | null;
  kappaNote: string;
}

export interface ProvenanceRun {
  id: number;
  pipeline: string;
  prompt: { id: string; version: string; hash: string; current: boolean };
  model: string;
  temperature: number;
  inputHash: string;
  sampleCount: number;
  cacheHit: boolean;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
  latencyMs: number;
  status: "OK" | "VALIDATION_FAILED" | "PROVIDER_ERROR";
  agreement: { sampleCount: number; agreement: number; spread?: number; has_high_discrepancy: boolean; votes?: Record<string, string>; contested?: string[] } | null;
  requestId: string | null;
  createdAt: string;
  samples: Array<{ id: number; sampleIndex: number; validated: boolean; createdAt: string }>;
}

export interface ReportProvenance {
  reportId: number;
  reportType: ReportType;
  createdAt: string;
  reliabilityVersion: number;
  runs: ProvenanceRun[];
  totals: { llmCalls: number; cacheHits: number; totalTokens: number; latencyMs: number };
}

export interface ReproduceResult {
  originalReportId: number;
  reproducedReportId: number;
  reportType: ReportType;
  reliability: ReliabilityMode;
  inputsUnchanged: boolean;
  promptsUnchanged: boolean;
  identical: boolean;
  headline: { before: Record<string, unknown>; after: Record<string, unknown>; changes: Record<string, { before: unknown; after: unknown }> };
  comparison: Array<{ pipeline: string; inputHashMatch: boolean; promptHashMatch: boolean; modelMatch: boolean; temperatureMatch: boolean }>;
  note: string;
}

export interface GeneratedPaperQuestion {
  sequenceNumber: number;
  text: string;
  marks: number;
  intendedBloom: BloomLevel;
  intendedOutcome: string | null;
  topic: string;
}

export interface GeneratedPaperResult extends ExplainableResult {
  reportId: number;
  courseId: number;
  constraints: { questionCount: number; totalMarks: number; targetBloom: Record<string, number>; outcomeWeights?: Record<string, number>; passThreshold: number; maxIterations: number };
  paper: { title: string; questions: GeneratedPaperQuestion[]; designNotes: string };
  verification: {
    objective: number;
    passed: boolean;
    scores: Record<string, number>;
    weights: Record<string, number>;
    violations: string[];
    observedBloom: Record<string, number>;
    observedOutcomes: Record<string, number>;
    marksTotal: number;
    nearDuplicates: Array<{ sequenceNumber: number; cosine: number }>;
    llmCalls: number;
  };
  iterations: Array<{ iteration: number; objective: number; passed: boolean; violations: string[]; feedback: string | null; questionCount: number }>;
  bestIteration: number;
  totalLlmCalls: number;
}

export type FullAnalysisKey = "examQuality" | "syllabusCoverage" | "questionReview" | "coMapping" | "similarity";

export interface FullAnalysisStep {
  key: FullAnalysisKey;
  label: string;
  status: "completed" | "failed" | "skipped";
  reportId?: number;
  error?: string;
  note?: string;
}

export interface FullAnalysisResult {
  courseId: number;
  questionPaperId: number;
  comparedAgainstPaperId: number | null;
  primaryReportId: number | null;
  completed: number;
  failed: number;
  steps: FullAnalysisStep[];
}

export interface CopilotChatResponse {
  sessionId: number;
  title: string;
  courseId: number;
  message: string;
  answer: string;
  reasoning: string;
  confidence: number;
  sources: string[];
  createdAt: string;
}

export interface CopilotMessageRecord {
  id: number;
  sessionId: number;
  role: "USER" | "ASSISTANT";
  content: string;
  aiReasoning: string | null;
  confidence: string | number | null;
  createdAt: string;
}

export interface CopilotSessionSummary {
  id: number;
  userId: number;
  courseId: number | null;
  examId: number | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  course?: { courseCode: string; courseName: string } | null;
  _count?: { messages: number };
}

export interface CopilotSessionDetail extends CopilotSessionSummary {
  messages: CopilotMessageRecord[];
}

export interface AnalysisReport {
  id: number;
  facultyId: number;
  courseId: number | null;
  questionPaperId: number | null;
  reportType: ReportType;
  resultJson: Record<string, unknown>;
  createdAt: string;
  recommendations: Recommendation[];
  explanation?: AIExplanation | null;
}
