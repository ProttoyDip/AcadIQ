import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { provenanceRepository } from "../repositories/provenance.repository";
import { reportRepository } from "../repositories/report.repository";
import { promptRegistrySnapshot, getPrompt } from "../ai/prompts/registry";
import { examAnalysisService } from "./examAnalysis.service";
import { syllabusAnalysisService } from "./syllabusAnalysis.service";
import { questionReviewService } from "./questionReview.service";
import { coMappingService } from "./coMapping.service";
import { similarityService } from "./similarity.service";
import { academicMemoryService } from "./academicMemory.service";
import { env } from "../config/env";

type Json = Record<string, unknown>;

function headline(reportType: string, result: Json): Record<string, unknown> {
  switch (reportType) {
    case "EXAM_QUALITY":
      return { qualityScore: result.qualityScore, coverage: (result.coverage as Json | undefined)?.percentage };
    case "SYLLABUS_COVERAGE":
      return { coveragePercentage: result.coveragePercentage, missingTopics: (result.missingTopics as unknown[] | undefined)?.length };
    case "QUESTION_SIMILARITY":
      return {
        overallDuplicationPercentage: result.overallDuplicationPercentage,
        matches: (result.matches as Json[] | undefined)?.map((m) => `${m.currentQuestionId}->${m.previousQuestionId}`).sort(),
      };
    case "QUESTION_REVIEW":
      return {
        qualityScore: result.qualityScore,
        bloom: Object.fromEntries(((result.questions as Json[] | undefined) ?? []).map((q) => [String(q.questionId), q.bloomLevel])),
      };
    case "CO_MAPPING":
      return {
        qualityScore: result.qualityScore,
        coveragePercentage: result.coveragePercentage,
        map: Object.fromEntries(((result.questionCOMap as Json[] | undefined) ?? []).map((m) => [String(m.questionId), m.courseOutcome])),
      };
    case "ACADEMIC_MEMORY":
      return {
        similarityScore: result.similarityScore,
        matches: (result.similarQuestions as Json[] | undefined)?.map((m) => `${m.newQuestionId}->${m.historicalQuestionId}`).sort(),
      };
    default:
      return {};
  }
}

function diffHeadline(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    const a = JSON.stringify(before[key]);
    const b = JSON.stringify(after[key]);
    if (a !== b) changes[key] = { before: before[key], after: after[key] };
  }
  return changes;
}

export const provenanceService = {
  async forReport(reportId: number, facultyId: number) {
    const report = await reportRepository.findById(reportId);
    if (!report || report.facultyId !== facultyId) throw new AppError("Report not found", 404);
    const runs = await provenanceRepository.findByReport(reportId);
    const registry = promptRegistrySnapshot();
    return {
      reportId,
      reportType: report.reportType,
      createdAt: report.createdAt,
      reliabilityVersion: (report.resultJson as Json | null)?.reliabilityVersion ?? 1,
      runs: runs.map((run) => ({
        id: run.id,
        pipeline: run.pipeline,
        prompt: {
          id: run.promptId,
          version: run.promptVersion,
          hash: run.promptHash,
          // Whether the prompt has changed since this report was produced.
          current: registry[run.promptId] === `${run.promptVersion}@${run.promptHash}`,
        },
        model: run.model,
        temperature: Number(run.temperature),
        inputHash: run.inputHash,
        sampleCount: run.sampleCount,
        cacheHit: run.cacheHit,
        usage: { promptTokens: run.promptTokens, completionTokens: run.completionTokens, totalTokens: run.totalTokens },
        latencyMs: run.latencyMs,
        status: run.status,
        agreement: run.agreementJson,
        requestId: run.requestId,
        createdAt: run.createdAt,
        samples: run.samples,
      })),
      totals: {
        llmCalls: runs.reduce((sum, run) => sum + (run.cacheHit ? 0 : run.sampleCount), 0),
        cacheHits: runs.filter((run) => run.cacheHit).length,
        totalTokens: runs.reduce((sum, run) => sum + (run.totalTokens ?? 0), 0),
        latencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0),
      },
    };
  },

  async sample(reportId: number, runId: number, sampleIndex: number, facultyId: number) {
    const report = await reportRepository.findById(reportId);
    if (!report || report.facultyId !== facultyId) throw new AppError("Report not found", 404);
    const sample = await provenanceRepository.findSample(runId, sampleIndex);
    if (!sample) throw new AppError("Sample not found", 404);
    const run = await prisma.analysisRun.findUnique({ where: { id: runId }, select: { reportId: true } });
    if (run?.reportId !== reportId) throw new AppError("Sample not found", 404);
    return sample;
  },

  /**
   * Re-runs the same analysis on the same stored inputs and diffs the headline
   * numbers. Honest about what can differ: prompt version, model, temperature,
   * and whether the underlying inputs changed (inputHash).
   */
  async reproduce(reportId: number, facultyId: number) {
    const original = await reportRepository.findById(reportId);
    if (!original || original.facultyId !== facultyId) throw new AppError("Report not found", 404);
    if (!original.courseId) throw new AppError("This report's course no longer exists, so it cannot be reproduced", 409);
    const originalRuns = await provenanceRepository.findByReport(reportId);
    const originalResult = (original.resultJson ?? {}) as Json;
    const courseId = original.courseId;
    const paperId = original.questionPaperId ?? undefined;
    const sampled = originalRuns.some((run) => run.sampleCount > 1);
    const reliability = sampled ? ("verified" as const) : ("fast" as const);

    let rerun: { reportId: number } & Json;
    switch (original.reportType) {
      case "EXAM_QUALITY":
        if (!paperId) throw new AppError("Question paper no longer exists", 409);
        rerun = await examAnalysisService.analyze(facultyId, { courseId, questionPaperId: paperId, reliability });
        break;
      case "SYLLABUS_COVERAGE":
        if (!paperId) throw new AppError("Question paper no longer exists", 409);
        rerun = await syllabusAnalysisService.analyze(facultyId, { courseId, questionPaperId: paperId });
        break;
      case "QUESTION_REVIEW":
        if (!paperId) throw new AppError("Question paper no longer exists", 409);
        rerun = await questionReviewService.analyze(facultyId, { courseId, questionPaperId: paperId, reliability });
        break;
      case "CO_MAPPING":
        if (!paperId) throw new AppError("Question paper no longer exists", 409);
        rerun = await coMappingService.analyze(facultyId, { courseId, questionPaperId: paperId, reliability });
        break;
      case "QUESTION_SIMILARITY": {
        if (!paperId) throw new AppError("Question paper no longer exists", 409);
        const previousQuestionId = ((originalResult.matches as Json[] | undefined) ?? [])[0]?.previousQuestionId as number | undefined;
        const previous = previousQuestionId
          ? await prisma.question.findUnique({ where: { id: previousQuestionId }, select: { paperId: true } })
          : null;
        if (!previous) throw new AppError("The previous paper cannot be identified from this report (no stored matches)", 409);
        rerun = await similarityService.analyze(facultyId, { courseId, currentPaperId: paperId, previousPaperId: previous.paperId, reliability });
        break;
      }
      case "ACADEMIC_MEMORY":
        if (!paperId) throw new AppError("Question paper no longer exists", 409);
        rerun = await academicMemoryService.check(facultyId, { courseId, questionPaperId: paperId, similarityThreshold: 40, reliability });
        break;
      default:
        throw new AppError(`Reproduction is not supported for ${original.reportType}`, 400);
    }

    const rerunRuns = await provenanceRepository.findByReport(rerun.reportId);
    const byPipeline = (runs: typeof originalRuns) => new Map(runs.map((run) => [run.pipeline, run]));
    const before = byPipeline(originalRuns);
    const after = byPipeline(rerunRuns);
    const pipelines = [...new Set([...before.keys(), ...after.keys()])];
    const comparison = pipelines.map((pipeline) => {
      const a = before.get(pipeline);
      const b = after.get(pipeline);
      return {
        pipeline,
        inputHashMatch: Boolean(a && b && a.inputHash === b.inputHash),
        promptHashMatch: Boolean(a && b && a.promptHash === b.promptHash),
        modelMatch: Boolean(a && b && a.model === b.model),
        temperatureMatch: Boolean(a && b && Number(a.temperature) === Number(b.temperature)),
        before: a ? { promptVersion: a.promptVersion, model: a.model, temperature: Number(a.temperature), inputHash: a.inputHash } : null,
        after: b ? { promptVersion: b.promptVersion, model: b.model, temperature: Number(b.temperature), inputHash: b.inputHash } : null,
      };
    });
    const beforeHeadline = headline(original.reportType, originalResult);
    const afterHeadline = headline(original.reportType, rerun);
    return {
      originalReportId: reportId,
      reproducedReportId: rerun.reportId,
      reportType: original.reportType,
      reliability,
      currentModel: env.openAiModel,
      comparison,
      inputsUnchanged: comparison.length > 0 && comparison.every((c) => c.inputHashMatch),
      promptsUnchanged: comparison.length > 0 && comparison.every((c) => c.promptHashMatch),
      headline: { before: beforeHeadline, after: afterHeadline, changes: diffHeadline(beforeHeadline, afterHeadline) },
      identical: Object.keys(diffHeadline(beforeHeadline, afterHeadline)).length === 0,
      note: sampled
        ? "Original was a sampled (verified) run; reproduction used the same sample count."
        : "Original was a single fast run; reproduction re-used prompt version and model recorded on the run where still available.",
      promptStatus: Object.fromEntries(originalRuns.map((run) => [run.promptId, getPrompt(run.promptId)?.hash === run.promptHash ? "current" : "changed"])),
    };
  },
};
