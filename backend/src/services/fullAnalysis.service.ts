import { examAnalysisService } from "./examAnalysis.service";
import { syllabusAnalysisService } from "./syllabusAnalysis.service";
import { questionReviewService } from "./questionReview.service";
import { coMappingService } from "./coMapping.service";
import { similarityService } from "./similarity.service";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";
import { FullAnalysisInput } from "../validators/analysis.validator";

export type FullAnalysisKey = "examQuality" | "syllabusCoverage" | "questionReview" | "coMapping" | "similarity";

export interface FullAnalysisStep {
  key: FullAnalysisKey;
  label: string;
  status: "completed" | "failed" | "skipped";
  reportId?: number;
  error?: string;
  note?: string;
}

const LABELS: Record<FullAnalysisKey, string> = {
  examQuality: "Exam Quality",
  syllabusCoverage: "Syllabus Coverage",
  questionReview: "Question Review",
  coMapping: "CO Mapping",
  similarity: "Question Similarity",
};

// Groq free tier is token-per-minute limited; two concurrent LLM calls stays under it with headroom.
const CONCURRENCY = 2;
// Steps that fail in the first pass (usually 429s) get one more sequential attempt after this pause.
const RETRY_DELAY_MS = 4_000;

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export const fullAnalysisService = {
  async analyze(facultyId: number, input: FullAnalysisInput) {
    const course = await courseRepository.findOwnedById(input.courseId, facultyId);
    if (!course) throw new AppError("Course not found", 404);

    const papers = await documentRepository.findQuestionPapersByCourse(input.courseId);
    const current = papers.find((paper) => paper.id === input.questionPaperId);
    if (!current) throw new AppError("Question paper not found for this course", 404);

    const previous = papers
      .filter((paper) => paper.id !== current.id && paper.questions.length > 0)
      .sort((a, b) => b.year - a.year || b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];

    const base = { courseId: input.courseId, questionPaperId: input.questionPaperId };

    const runners: { key: FullAnalysisKey; run: () => Promise<{ reportId: number }> }[] = [
      { key: "examQuality", run: () => examAnalysisService.analyze(facultyId, base) },
      { key: "syllabusCoverage", run: () => syllabusAnalysisService.analyze(facultyId, base) },
      { key: "questionReview", run: () => questionReviewService.analyze(facultyId, base) },
      { key: "coMapping", run: () => coMappingService.analyze(facultyId, base) },
    ];
    if (previous) {
      runners.push({
        key: "similarity",
        run: () =>
          similarityService.analyze(facultyId, {
            courseId: input.courseId,
            currentPaperId: current.id,
            previousPaperId: previous.id,
          }),
      });
    }

    const runStep = async ({ key, run }: (typeof runners)[number]): Promise<FullAnalysisStep> => {
      try {
        const result = await run();
        return { key, label: LABELS[key], status: "completed", reportId: result.reportId };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        logger.warn("full_analysis_step_failed", { key, paperId: current.id, error: message });
        return { key, label: LABELS[key], status: "failed", error: message };
      }
    };

    const steps = await runWithConcurrency(runners.map((runner) => () => runStep(runner)), CONCURRENCY);

    const retryable = steps.filter((step) => step.status === "failed");
    if (retryable.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      for (const failedStep of retryable) {
        const runner = runners.find((r) => r.key === failedStep.key)!;
        const retried = await runStep(runner);
        steps[steps.indexOf(failedStep)] = retried;
      }
    }

    if (!previous) {
      steps.push({
        key: "similarity",
        label: LABELS.similarity,
        status: "skipped",
        note: "No earlier question paper exists for this course to compare against.",
      });
    }

    const primary = steps.find((step) => step.key === "examQuality" && step.status === "completed")
      ?? steps.find((step) => step.status === "completed");

    return {
      courseId: input.courseId,
      questionPaperId: current.id,
      comparedAgainstPaperId: previous?.id ?? null,
      primaryReportId: primary?.reportId ?? null,
      completed: steps.filter((step) => step.status === "completed").length,
      failed: steps.filter((step) => step.status === "failed").length,
      steps,
    };
  },
};
