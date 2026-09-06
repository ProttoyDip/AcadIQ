export interface Course {
  id: number;
  facultyId: number;
  courseCode: string;
  courseName: string;
  description?: string | null;
  createdAt: string;
  syllabusDocuments?: SyllabusDocument[];
  questionPapers?: QuestionPaper[];
}

export interface SyllabusDocument {
  id: number;
  courseId: number;
  filePath: string;
  uploadedAt: string;
}

export interface QuestionPaper {
  id: number;
  courseId: number;
  year: number;
  semester: string;
  filePath: string;
  questions?: Question[];
}

export interface Question {
  id: number;
  paperId: number;
  questionText: string;
  marks: number;
  topic?: string | null;
  bloomLevel?: string | null;
}

export type BloomLevel = "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

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

export interface Recommendation {
  id?: number;
  message: string;
  priority: Priority;
}

export interface ExamQualityResult {
  reportId: number;
  overallScore: number;
  topicCoverage: TopicCoverage[];
  bloomDistribution: BloomDistribution[];
  marksDistribution: { topic: string; marks: number; percentage: number }[];
  learningOutcomeAlignment: { outcome: string; addressed: boolean }[];
  recommendations: Recommendation[];
}

export interface SyllabusCoverageResult {
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
}

export interface QuestionSimilarityResult {
  reportId: number;
  matches: SimilarityMatch[];
  overallDuplicationPercentage: number;
  recommendation: string;
}

export type ReportType = "EXAM_QUALITY" | "SYLLABUS_COVERAGE" | "QUESTION_SIMILARITY";

export interface AnalysisReport {
  id: number;
  facultyId: number;
  reportType: ReportType;
  resultJson: Record<string, unknown>;
  createdAt: string;
  recommendations: Recommendation[];
}
