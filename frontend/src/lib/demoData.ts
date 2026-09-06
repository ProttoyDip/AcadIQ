import { QualityTrendPoint } from "../components/analytics/QualityTrendChart";
import { CoCoveragePoint } from "../components/analytics/CoCoverageChart";
import { BloomDistribution, QuestionSimilarityResult } from "../types";

/**
 * Realistic seed data shown until a faculty member has real courses/reports.
 * Mirrors the exact shapes the live API returns so swapping to real data is
 * invisible to the UI — nothing here is hand-waved to a simpler schema.
 */

export const DEMO_STATS = {
  courses: 6,
  examsAnalyzed: 21,
  avgScore: 82,
  recommendations: 47,
};

export const DEMO_TREND: QualityTrendPoint[] = [
  { label: "Feb", score: 68 },
  { label: "Mar", score: 71 },
  { label: "Apr", score: 74 },
  { label: "May", score: 70 },
  { label: "Jul", score: 78 },
  { label: "Aug", score: 81 },
  { label: "Sep", score: 85 },
  { label: "Oct", score: 89 },
];

export const DEMO_BLOOM: BloomDistribution[] = [
  { level: "REMEMBER", questionCount: 6, marksAllocated: 18, percentage: 18 },
  { level: "UNDERSTAND", questionCount: 8, marksAllocated: 24, percentage: 24 },
  { level: "APPLY", questionCount: 9, marksAllocated: 26, percentage: 26 },
  { level: "ANALYZE", questionCount: 6, marksAllocated: 18, percentage: 18 },
  { level: "EVALUATE", questionCount: 3, marksAllocated: 9, percentage: 9 },
  { level: "CREATE", questionCount: 2, marksAllocated: 5, percentage: 5 },
];

export const DEMO_CO_COVERAGE: CoCoveragePoint[] = [
  { outcome: "CO1", percentage: 92 },
  { outcome: "CO2", percentage: 85 },
  { outcome: "CO3", percentage: 70 },
  { outcome: "CO4", percentage: 45 },
  { outcome: "CO5", percentage: 88 },
];

/**
 * Shown on an Exam Quality report page when the faculty member hasn't yet run a
 * separate Question Similarity check for this course — keeps the unified report
 * page complete without fabricating a fake report id.
 */
export const DEMO_SIMILARITY: QuestionSimilarityResult = {
  reportId: -1,
  matches: [
    { currentQuestionId: 4, previousQuestionId: 2, similarityPercentage: 91, matchType: "DUPLICATE" },
    { currentQuestionId: 7, previousQuestionId: 9, similarityPercentage: 68, matchType: "SIMILAR_CONCEPT" },
    { currentQuestionId: 11, previousQuestionId: 5, similarityPercentage: 52, matchType: "REPEATED_PATTERN" },
  ],
  overallDuplicationPercentage: 22,
  recommendation:
    "Replace question 4 with a new application-based question — it is nearly identical to a question from the previous semester's paper.",
};

export interface DemoReport {
  id: number;
  title: string;
  courseCode: string;
  reportType: "EXAM_QUALITY" | "SYLLABUS_COVERAGE" | "QUESTION_SIMILARITY";
  score: number;
  createdAt: string;
  highPriorityCount: number;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const DEMO_RECENT_REPORTS: DemoReport[] = [
  {
    id: 1001,
    title: "Database Systems — Midterm",
    courseCode: "CSE 3811",
    reportType: "EXAM_QUALITY",
    score: 89,
    createdAt: daysAgo(1),
    highPriorityCount: 1,
  },
  {
    id: 1002,
    title: "Algorithms — Final Exam",
    courseCode: "CSE 2213",
    reportType: "QUESTION_SIMILARITY",
    score: 66,
    createdAt: daysAgo(3),
    highPriorityCount: 2,
  },
  {
    id: 1003,
    title: "Software Engineering — Syllabus Review",
    courseCode: "CSE 3711",
    reportType: "SYLLABUS_COVERAGE",
    score: 91,
    createdAt: daysAgo(6),
    highPriorityCount: 0,
  },
  {
    id: 1004,
    title: "Computer Networks — Midterm",
    courseCode: "CSE 3421",
    reportType: "EXAM_QUALITY",
    score: 64,
    createdAt: daysAgo(8),
    highPriorityCount: 3,
  },
  {
    id: 1005,
    title: "Operating Systems — Quiz 2",
    courseCode: "CSE 3111",
    reportType: "EXAM_QUALITY",
    score: 77,
    createdAt: daysAgo(11),
    highPriorityCount: 1,
  },
];
