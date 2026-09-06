import { retrieveAcademicData, CopilotIntent } from "./retrieval.service";

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
  }>;
  examQuality?: { qualityScore: number; issues: unknown[]; recommendations: unknown[]; positivePoints: unknown[] };
  coCoverage?: { qualityScore: number; coverage: Record<string, number>; missingOutcomes: string[] };
  academicMemory?: { similarityScore: number; similarQuestionCount: number; replacementSuggestion: string };
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
  reportId: number | undefined
): Promise<CopilotContext> {
  const data = await retrieveAcademicData(facultyId, courseId, examId, reportId);

  const sources: string[] = [];
  if (data.syllabusExcerpt) sources.push("Course Syllabus");
  if (data.courseOutcomes.length > 0) sources.push("Course Outcomes");
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
