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
  courseOutcomes?: Array<{ id: number; code: string; description: string }>;
}

export interface SyllabusDocument {
  id: number;
  courseId: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface TeachingMaterial {
  id: number;
  title: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  kind: "SLIDES" | "NOTES" | "HANDOUT" | "OTHER";
  chunkCount: number;
  uploadedAt: string;
  textChars?: number;
}

export interface UploadDuplicateWarning {
  questionId: number;
  sequenceNumber: number;
  matches: Array<{ questionId: number; paperId: number; sequenceNumber: number; semester: string; year: number; cosine: number }>;
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
  /** Present on upload responses: new questions that near-duplicate the existing course bank. */
  duplicateWarnings?: UploadDuplicateWarning[];
}

export interface NeighbourHit {
  questionId: number;
  questionText: string;
  paperId: number;
  sequenceNumber: number;
  semester: string;
  year: number;
  bloomLevel: string | null;
  topic: string | null;
  cosine: number;
  nearDuplicate: boolean;
}

export interface CopilotRetrieval {
  method: "EMBEDDING" | "FULL_CONTEXT";
  syllabusChunks: number;
  syllabusChars: number;
  materialChunks?: number;
  relevantQuestions: number[];
  reason?: string;
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
  agreementMode?: "self-consistency" | "cross-model";
  agreementModels?: string[];
  retrievalSupport?: number | null;
  reliabilityNote?: string;
  reliabilityVersion?: 2;
}

export type ReliabilityMode = "fast" | "verified" | "cross-model";

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
  grounding?: { focus?: "taught" | "balanced" | "syllabus"; teachingMaterials: number; materialChunks: number; materialChars: number; syllabusChars: number; materialIds?: number[] | null };
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
  retrieval?: CopilotRetrieval;
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

/* ---------- Faculty workflows: marks, rubrics, blueprint, question bank, lecture plan, gaps ---------- */

export interface MarksUploadResult {
  paperId: number;
  students: number;
  questionsMatched: number;
  questionsInPaper: number;
  unmatchedQuestions: number[];
  unknownColumns: string[];
}

export interface MarksSummary {
  paperId: number;
  students: number;
  uploadedAt: string | null;
}

export interface ItemStat {
  questionId: number;
  sequenceNumber: number;
  maxMarks: number;
  text: string;
  bloomLevel: string | null;
  topic: string | null;
  mean: number;
  sd: number;
  difficulty: number;
  difficultyBand: "EASY" | "MODERATE" | "HARD";
  discrimination: number;
  discriminationBand: "EXCELLENT" | "GOOD" | "MARGINAL" | "POOR";
  pointBiserial: number | null;
  zeroRate: number;
  fullMarksRate: number;
}

export interface GroupAttainment {
  key: string;
  label: string;
  questionCount: number;
  maxMarks: number;
  meanPercent: number;
  studentsAboveThreshold: number;
  attainmentLevel: 0 | 1 | 2 | 3;
  questionSequence: number[];
}

export interface MarksAnalysisResult {
  paperId: number;
  courseId: number;
  paper: { year: number; semester: string };
  thresholdPercent: number;
  students: number;
  items: ItemStat[];
  totals: {
    maxMarks: number;
    mean: number;
    median: number;
    sd: number;
    min: number;
    max: number;
    passMarkPercent: number;
    passRate: number;
    cronbachAlpha: number | null;
    alphaBand: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "QUESTIONABLE" | "POOR" | null;
  };
  distribution: Array<{ label: string; from: number; to: number; count: number }>;
  bloomAttainment: GroupAttainment[];
  topicAttainment: GroupAttainment[];
  coAttainment: GroupAttainment[];
  coMappingSource: { reportId: number; createdAt: string } | null;
  recommendations: Array<{ message: string; priority: Priority; questionId?: number }>;
  note: string;
}

export interface RubricQuestionScheme {
  questionId: number;
  sequenceNumber: number;
  marks: number;
  modelAnswer: string;
  markingPoints: Array<{ point: string; marks: number }>;
  partialCreditRules: string[];
  commonErrors: string[];
}

export interface RubricRecord {
  id: number;
  courseId: number;
  questionPaperId: number | null;
  name: string;
  description: string | null;
  criteria: { questions: RubricQuestionScheme[]; generalGuidance: string[]; rescaled?: number[] };
  maxScore: number | string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionRewriteVariant {
  text: string;
  bloomLevel: BloomLevel;
  marks: number;
  rationale: string;
}

export interface QuestionRewriteResult {
  original: { text: string; marks: number };
  mode: string;
  variants: QuestionRewriteVariant[];
}

export interface ExamBlueprint {
  id?: number;
  courseId: number;
  targetBloom: Record<string, number>;
  outcomeWeights: Record<string, number> | null;
  topicWeights: Record<string, number> | null;
  totalMarks: number;
  questionCount: number;
  notes: string | null;
  updatedAt?: string;
  isDefault?: boolean;
}

export interface BlueprintComparison {
  courseId: number;
  paperId: number;
  totalMarks: number;
  labelledMarks: number;
  unlabelledQuestions: number;
  bloom: Array<{ level: string; target: number; observed: number; deviation: number }>;
  outcomes: Array<{ code: string; target: number; observed: number; deviation: number }> | null;
  topics: Array<{ topic: string; target: number; observed: number; deviation: number }> | null;
  maxAbsDeviation: number;
  fitScore: number;
  verdict: "ON_TARGET" | "MINOR_DRIFT" | "OFF_TARGET";
  notes: string[];
}

export interface BankQuestion extends Question {
  paper: { id: number; year: number; semester: string };
  usedCount: number;
}

export interface LecturePlanWeek {
  week: number;
  title: string;
  topics: string[];
  outcomes: string[];
  activities: string[];
  assessment: string | null;
  materialsHint: string | null;
}

export interface LecturePlanRecord {
  id: number;
  courseId: number;
  weeks: number;
  hoursPerWeek: number;
  planJson: { title: string; weeks: LecturePlanWeek[]; assumptions: string[] };
  createdAt: string;
}

export interface MaterialGapTopic {
  chunkIndex: number;
  excerpt: string;
  bestSimilarity: number;
  status: "COVERED" | "PARTIAL" | "GAP";
  bestMaterial: { materialId: number; title: string; locator: string | null } | null;
}

export interface MaterialGapResult {
  courseId: number;
  syllabusChunks: number;
  materials: number;
  covered: number;
  partial: number;
  gaps: number;
  coveragePercent: number;
  topics: MaterialGapTopic[];
  method: "EMBEDDING" | "UNAVAILABLE";
  note: string;
}

/* ---------- Timetable ---------- */

export type SessionStatus = "SCHEDULED" | "HELD" | "CANCELLED" | "RESCHEDULED" | "HOLIDAY" | "MAKEUP";
export type SlotKind = "LECTURE" | "LAB" | "TUTORIAL" | "OFFICE_HOUR" | "OTHER";

export interface Term {
  id: number;
  facultyId: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  feedToken?: string | null;
  createdAt: string;
  _count?: { slots: number; sessions: number; events: number };
}

export interface ClassSlot {
  id: number;
  termId: number;
  courseId: number | null;
  courseLabel: string;
  section: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: SlotKind;
  source: "MANUAL" | "AI_IMPORT";
  course?: { id: number; courseCode: string; courseName: string } | null;
}

export interface SlotDraft {
  courseId?: number | null;
  courseLabel: string;
  section?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  kind: SlotKind;
  source?: "MANUAL" | "AI_IMPORT";
}

export interface ExtractedSlot extends SlotDraft {
  confidence: number;
  matchedCourse: string | null;
}

export interface RoutineExtractResult {
  file: string;
  facultyName: string;
  initials: string;
  scope?: "PERSONAL" | "FACULTY";
  method?: "DOCUMENT" | "VISION";
  slots: ExtractedSlot[];
  termHint: { name: string | null; startDate: string | null; endDate: string | null } | null;
  warnings: string[];
  lowConfidence: number;
  textChars: number;
}

export interface CalendarEvent {
  id: number;
  termId: number;
  date: string;
  endDate: string | null;
  kind: "HOLIDAY" | "EXAM_WEEK" | "DEADLINE" | "ASSESSMENT" | "OTHER";
  title: string;
  source: string;
  courseId?: number | null;
  section?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  course?: { id: number; courseCode: string } | null;
}

export interface Clash {
  severity: "HIGH" | "MEDIUM" | "LOW";
  rule: "SAME_DAY" | "OVERLOADED_WEEK" | "OVERLAPS_CLASS" | "ON_BLOCKED_DAY" | "UNTAUGHT_TOPICS";
  message: string;
  hint: string;
  eventIds: number[];
  sessionId?: number;
}

export interface WorkloadReport {
  termId: number;
  termName: string;
  contactHoursPerWeek: number;
  perCourse: Array<{ courseLabel: string; hoursPerWeek: number; sessions: number; held: number; cancelled: number; makeups: number }>;
  perWeekday: Array<{ day: string; dayOfWeek: number; hours: number; classes: number }>;
  heatmap: { hours: number[]; rows: Array<{ dayOfWeek: number; day: string; cells: number[] }> };
  statusCounts: Record<string, number>;
  cancellationRate: number;
  makeupCoverage: number;
  busiestDay: string | null;
  peakWeeks: Array<{ week: number; hours: number }>;
  totalWeeks: number;
}

export interface DigestPrefs {
  digestEnabled: boolean;
  digestHour: number;
  digestLastSent: string | null;
  timezone: string | null;
  serverTimezone?: string;
  email: string;
  mailerConfigured: boolean;
}

export interface DigestPreview {
  subject: string;
  html: string;
  text: string;
  prefs: DigestPrefs;
  mailerConfigured: boolean;
}

export interface FreeRoomsResult {
  date: string;
  startTime: string;
  endTime: string;
  free: string[];
  busy: Array<{ room: string; occupiedBy: string }>;
  source: "DEPARTMENT_ROUTINE" | "NONE";
}

export interface DepartmentRoutine {
  id: number;
  termLabel: string;
  originalName: string;
  slotCount: number;
  createdAt: string;
  uploadedBy?: { name: string };
}

export interface DepartmentSlot {
  id: number;
  courseLabel: string;
  section: string | null;
  teacher: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: string;
}

/* ---------- Assistant ---------- */

export interface AssistantPendingAction {
  index: number;
  tool: string;
  args: Record<string, unknown>;
  label: string;
  why: string;
  mutating: boolean;
}

export interface AssistantChatReply {
  reply: string;
  followUpQuestion: string | null;
  navigate: string | null;
  pendingActions: AssistantPendingAction[];
  actionToken: string | null;
  results: Array<{ tool: string; label: string; ok: boolean; result?: unknown; error?: string }>;
  rejected: Array<{ tool: string; reason: string }>;
  context: { today: string; term: string | null; makeupDebt: number };
}

export interface AssistantExecuteResult {
  results: Array<{ index: number; tool: string; ok: boolean; skipped?: boolean; result?: unknown; error?: string }>;
  summary: string;
}

export interface ClassSession {
  id: number;
  termId: number;
  slotId: number | null;
  courseId: number | null;
  courseLabel: string;
  section: string | null;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: SlotKind;
  status: SessionStatus;
  reason: string | null;
  rescheduledFromId: number | null;
  plannedWeek: number | null;
  plannedTopics: string[] | null;
  coveredTopics: string[] | null;
  notes: string | null;
  materialIds: number[] | null;
  loggedAt: string | null;
  course?: { id: number; courseCode: string; courseName: string } | null;
}

export interface FreeSlotCandidate {
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  score: number;
  reasons: string[];
}

export interface MakeupDebt {
  total: number;
  courses: Array<{ courseId: number | null; courseLabel: string; owed: Array<Pick<ClassSession, "id" | "date" | "startTime" | "endTime" | "status" | "reason" | "section" | "courseLabel">> }>;
}

export interface TodayBriefing {
  term: Term | null;
  date: string;
  sessions: Array<ClassSession & { lastLog: { date: string; coveredTopics: string[] | null; notes: string | null } | null }>;
  upcoming: ClassSession[];
  makeupDebt?: number;
}

export interface PaceReport {
  courseId: number;
  term: { id: number; name: string } | null;
  planId: number | null;
  plannedTopics: string[];
  coveredTopics: string[];
  remainingTopics: string[];
  sessions: { total: number; held: number; past?: number; remaining: number; lost: number };
  expectedCoveredByNow: number;
  deltaTopics: number;
  topicsPerRemainingSession?: number | null;
  status: "AHEAD" | "ON_TRACK" | "BEHIND" | "AT_RISK" | "NO_PLAN" | "NO_TERM";
  note: string;
}

export interface ReplanResult {
  sessions: Array<{ sessionId: number; date: string; topics: string[]; note: string | null }>;
  dropped: string[];
  compressed: string[];
  summary: string;
  applied: boolean;
  remainingSessions: number;
}

export interface ClassNotice {
  channel: "EMAIL" | "CHAT";
  subject: string | null;
  body: string;
}
