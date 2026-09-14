import { retrieveAcademicData, CopilotIntent } from "./retrieval.service";
import { AcademicMemoryResult } from "../../models/types";

/**
 * The academic memory pipeline attaches resolved question text to each match
 * alongside the strict AcademicMemoryResult shape (id-only) so the Copilot can
 * name the actual repeated question instead of only citing an aggregate score.
 */
function topAcademicMemoryMatch(memory: AcademicMemoryResult) {
  const richest = memory.similarQuestions as unknown as Array<{
    similarityScore: number;
    newQuestionText?: string;
    historicalQuestionText?: string;
  }>;
  const top = richest.slice().sort((a, b) => b.similarityScore - a.similarityScore)[0];
  if (!top?.newQuestionText || !top?.historicalQuestionText) return undefined;
  return {
    currentQuestionText: top.newQuestionText,
    previousQuestionText: top.historicalQuestionText,
    similarityPercentage: top.similarityScore,
  };
}

export interface CopilotContext {
  courseCode: string;
  courseName: string;
  syllabusExcerpt?: string;
  courseOutcomes?: Array<{ code: string; description: string }>;
  paperMetadata?: { year: number; semester: string; originalName: string };
  questions?: Array<{
    sequenceNumber: number;
    questionText: string;
    marks: number;
    bloomLevel?: string | null;
    topic?: string | null;
    relevance?: number;
  }>;
  retrieval: {
    method: "EMBEDDING" | "FULL_CONTEXT";
    syllabusChunks: number;
    syllabusChars: number;
    materialChunks: number;
    relevantQuestions: number[];
    reason?: string;
  };
  materialPassages?: Array<{ title: string; kind: string; locator: string | null; content: string; similarity: number }>;
  examQuality?: { qualityScore: number; issues: unknown[]; recommendations: unknown[]; positivePoints: unknown[] };
  coCoverage?: { qualityScore: number; coverage: Record<string, number>; missingOutcomes: string[] };
  academicMemory?: {
    similarityScore: number;
    similarQuestionCount: number;
    replacementSuggestion: string;
    topMatch?: { currentQuestionText: string; previousQuestionText: string; similarityPercentage: number };
  };
  questionQuality?: { qualityScore: number; lowClarityCount: number };
  sources: string[];
}

/**
 * Step 3 of the retrieval flow: "Build AI context". Turns raw retrieved rows
 * into the compact, prompt-ready shape prompt.service.ts consumes, and
 * computes `sources` directly from what was actually found — never from
 * anything the model claims later, so the response can't cite data that was
 * never retrieved.
 */
export async function assembleContext(
  facultyId: number,
  courseId: number,
  examId: number | undefined,
  reportId: number | undefined,
  message = ""
): Promise<CopilotContext> {
  const data = await retrieveAcademicData(facultyId, courseId, examId, reportId, message);

  const sources: string[] = [];
  if (data.syllabusExcerpt) sources.push(data.retrieval.method === "EMBEDDING" && data.retrieval.syllabusChunks > 0 ? `Course Syllabus (${data.retrieval.syllabusChunks} relevant passages)` : "Course Syllabus");
  if (data.courseOutcomes.length > 0) sources.push("Course Outcomes");
  if (data.materialPassages.length > 0) {
    const titles = [...new Set(data.materialPassages.map((p) => p.title))];
    sources.push(`Teaching Materials (${titles.slice(0, 3).join(", ")}${titles.length > 3 ? ", …" : ""})`);
  }
  if (data.paperMetadata) sources.push(`Question Paper (${data.paperMetadata.semester} ${data.paperMetadata.year})`);
  if (data.examQuality) sources.push("Exam Quality Report");
  if (data.coMapping) sources.push("CO Mapping Report");
  if (data.academicMemory) sources.push("Academic Memory Report");
  if (data.similarity) sources.push("Question Similarity Report");
  if (data.questionReview) sources.push("Question Review Report");

  return {
    courseCode: data.course.courseCode,
    courseName: data.course.courseName,
    syllabusExcerpt: data.syllabusExcerpt,
    courseOutcomes: data.courseOutcomes,
    paperMetadata: data.paperMetadata,
    questions: data.questions,
    retrieval: data.retrieval,
    materialPassages: data.materialPassages,
    examQuality: data.examQuality,
    coCoverage: data.coMapping
      ? {
          qualityScore: data.coMapping.qualityScore,
          coverage: data.coMapping.coverage,
          missingOutcomes: data.coMapping.missingOutcomes,
        }
      : undefined,
    academicMemory: data.academicMemory
      ? {
          similarityScore: data.academicMemory.similarityScore,
          similarQuestionCount: data.academicMemory.similarQuestions.length,
          replacementSuggestion: data.academicMemory.replacementSuggestion,
          topMatch: topAcademicMemoryMatch(data.academicMemory),
        }
      : data.similarity
        ? {
            similarityScore: data.similarity.overallDuplicationPercentage,
            similarQuestionCount: data.similarity.matches.length,
            replacementSuggestion: data.similarity.recommendation,
          }
        : undefined,
    questionQuality: data.questionReview
      ? {
          qualityScore: data.questionReview.qualityScore,
          lowClarityCount: data.questionReview.questions.filter((q) => q.clarityScore < 50).length,
        }
      : undefined,
    sources,
  };
}

export type { CopilotIntent };
