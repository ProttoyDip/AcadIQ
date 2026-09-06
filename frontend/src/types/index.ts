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

export interface AIExplanation {
  decision: string;
  reason: string;
  confidence: number;
}

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
}

export interface QuestionSimilarityResult extends ExplainableResult {
  reportId: number;
  matches: SimilarityMatch[];
  overallDuplicationPercentage: number;
  recommendation: string;
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
  | "CO_MAPPING";

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
