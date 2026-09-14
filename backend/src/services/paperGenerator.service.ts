import { z } from "zod";
import { AppError } from "../middleware/error.middleware";
import { BloomLevel } from "../models/types";
import { PAPER_GENERATION_PROMPT } from "../ai/prompts/paperGeneration.prompt";
import { paperGenerationResponseSchema } from "../ai/schemas/analysisResponse.schema";
import { runLlmAnalysis } from "../ai/runner";
import { runQuestionReviewPipeline } from "../ai/pipeline/questionReviewPipeline";
import { runCoMappingPipeline } from "../ai/pipeline/coMappingPipeline";
import { runSyllabusCoveragePipeline } from "../ai/pipeline/syllabusPipeline";
import { embeddingService } from "../ai/embedding/embeddingService";
import { dot } from "../ai/embedding/vectorMath";
import { applyCalculatedConfidence, withDecisionContract } from "../ai/confidence";
import { env } from "../config/env";
import { courseRepository } from "../repositories/course.repository";
import { reportRepository } from "../repositories/report.repository";
import { prisma } from "../database/prismaClient";
import { logger } from "../utils/logger";
import { loadReliabilityEvidence, loadSyllabusText } from "./analysisContext.service";
import { tracedAnalysis } from "./traced";

const BLOOM_LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;

export const generatePaperSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  questionCount: z.coerce.number().int().min(3).max(30).default(8),
  totalMarks: z.coerce.number().int().min(10).max(500).default(100),
  /** Percent of marks per Bloom level; normalised server-side. */
  targetBloom: z.record(z.enum(BLOOM_LEVELS), z.number().min(0).max(100)).optional(),
  /** Percent of marks per CO code; normalised server-side. */
  outcomeWeights: z.record(z.string().trim().min(1).max(30), z.number().min(0).max(100)).optional(),
  passThreshold: z.coerce.number().min(50).max(100).default(75),
  maxIterations: z.coerce.number().int().min(1).max(3).default(2),
});
export type GeneratePaperInput = z.infer<typeof generatePaperSchema>;

type Candidate = z.infer<typeof paperGenerationResponseSchema>;

interface VerifierScores {
  clarity: number;
  bloomFit: number;
  outcomeFit: number;
  syllabusCoverage: number;
  originality: number;
}

interface Verification {
  objective: number;
  passed: boolean;
  scores: VerifierScores;
  weights: VerifierScores;
  violations: string[];
  observedBloom: Record<string, number>;
  observedOutcomes: Record<string, number>;
  marksTotal: number;
  nearDuplicates: Array<{ sequenceNumber: number; cosine: number }>;
  llmCalls: number;
}

export interface GenerationIteration {
  iteration: number;
  candidate: Candidate;
  verification: Verification;
  feedback: string | null;
}

const WEIGHTS: VerifierScores = { clarity: 25, bloomFit: 25, outcomeFit: 20, syllabusCoverage: 20, originality: 10 };
const DEFAULT_BLOOM: Record<string, number> = { REMEMBER: 10, UNDERSTAND: 20, APPLY: 30, ANALYZE: 20, EVALUATE: 10, CREATE: 10 };

function normalise(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return weights;
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, (v / total) * 100]));
}

/** 100 − half the L1 distance between two percentage distributions (0 = disjoint, 100 = identical). */
function distributionFit(target: Record<string, number>, observed: Record<string, number>): number {
  const keys = new Set([...Object.keys(target), ...Object.keys(observed)]);
  let l1 = 0;
  for (const key of keys) l1 += Math.abs((target[key] ?? 0) - (observed[key] ?? 0));
  return Math.max(0, Math.round(100 - l1 / 2));
}

function marksByKey<T>(items: T[], key: (item: T) => string | null, marks: (item: T) => number, total: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    out[k] = (out[k] ?? 0) + (marks(item) / total) * 100;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 10) / 10]));
}

export const paperGeneratorService = {
  generate(facultyId: number, input: GeneratePaperInput) {
    return tracedAnalysis(async () => {
      const course = await courseRepository.findOwnedById(input.courseId, facultyId);
      if (!course) throw new AppError("Course not found", 404);
      const syllabusText = await loadSyllabusText(input.courseId);
      const outcomes = await courseRepository.findOutcomes(input.courseId);
      const targetBloom = normalise(input.targetBloom ?? DEFAULT_BLOOM);
      const outcomeWeights = input.outcomeWeights
        ? normalise(input.outcomeWeights)
        : outcomes.length
          ? normalise(Object.fromEntries(outcomes.map((o) => [o.code, 1])))
          : undefined;
      if (outcomeWeights) {
        const known = new Set(outcomes.map((o) => o.code));
        for (const code of Object.keys(outcomeWeights)) if (!known.has(code)) throw new AppError(`Unknown course outcome ${code}`, 422);
      }

      // Existing bank: what the generator must not recycle, and what originality is measured against.
      const bank = await prisma.question.findMany({
        where: { paper: { courseId: input.courseId } },
        select: { id: true, questionText: true },
        orderBy: { id: "desc" },
        take: 300,
      });
      const bankVectors = embeddingService.available && bank.length
        ? await embeddingService.ensureIndexed("QUESTION", bank.map((q) => ({ id: q.id, text: q.questionText, courseId: input.courseId })))
        : null;

      const iterations: GenerationIteration[] = [];
      let feedback: string | undefined;
      let previous: Candidate | undefined;
      let totalLlmCalls = 0;

      for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
        const generation = await runLlmAnalysis(
          PAPER_GENERATION_PROMPT,
          [{
            syllabusText,
            courseOutcomes: outcomes,
            constraints: { questionCount: input.questionCount, totalMarks: input.totalMarks, targetBloom, outcomeWeights },
            avoidQuestions: bank.map((q) => q.questionText),
            feedback,
            previousQuestions: previous?.questions.map(({ sequenceNumber, text, marks }) => ({ sequenceNumber, text, marks })),
          }],
          paperGenerationResponseSchema,
          // Repairs must not replay the previous candidate from cache.
          { cache: false, temperature: 0.5 }
        );
        totalLlmCalls += 1;
        const candidate = generation.consensus;
        const verification = await verify(candidate, { syllabusText, outcomes, targetBloom, outcomeWeights, input, bankVectors });
        totalLlmCalls += verification.llmCalls;
        const nextFeedback = verification.passed ? null : verification.violations.map((v, i) => `${i + 1}. ${v}`).join("\n");
        iterations.push({ iteration, candidate, verification, feedback: nextFeedback });
        logger.info("paper_generation_iteration", { courseId: input.courseId, iteration, objective: verification.objective, passed: verification.passed });
        if (verification.passed) break;
        feedback = nextFeedback ?? undefined;
        previous = candidate;
      }

      const best = iterations.reduce((a, b) => (b.verification.objective > a.verification.objective ? b : a));
      const evidence = await loadReliabilityEvidence(input.courseId, {
        sourceTexts: best.candidate.questions.map((q) => q.text),
        syllabusText,
        courseOutcomeCount: outcomes.length,
      });
      const explanation = applyCalculatedConfidence(
        {
          decision: best.verification.passed ? "CANDIDATE_PAPER_PASSED_VERIFICATION" : "CANDIDATE_PAPER_BELOW_THRESHOLD",
          reason: best.verification.passed
            ? `Iteration ${best.iteration} scored ${best.verification.objective}/100 against a ${input.passThreshold} threshold on the machine-checkable objective (clarity, Bloom fit, CO fit, syllabus coverage, originality).`
            : `After ${iterations.length} iteration${iterations.length === 1 ? "" : "s"} the best candidate scored ${best.verification.objective}/100, below the ${input.passThreshold} threshold. Remaining violations: ${best.verification.violations.join("; ") || "none listed"}.`,
          confidence: 0,
        },
        evidence
      );
      const result = withDecisionContract({
        courseId: input.courseId,
        constraints: { questionCount: input.questionCount, totalMarks: input.totalMarks, targetBloom, outcomeWeights, passThreshold: input.passThreshold, maxIterations: input.maxIterations },
        paper: best.candidate,
        verification: best.verification,
        iterations: iterations.map((it) => ({ iteration: it.iteration, objective: it.verification.objective, passed: it.verification.passed, violations: it.verification.violations, feedback: it.feedback, questionCount: it.candidate.questions.length })),
        bestIteration: best.iteration,
        totalLlmCalls,
        explanation,
      });
      const report = await reportRepository.createExplainable(
        { facultyId, courseId: input.courseId, reportType: "GENERATED_PAPER", resultJson: result },
        best.verification.violations.slice(0, 5).map((message) => ({ message, priority: "MEDIUM" as const })),
        explanation
      );
      return { reportId: report.id, ...result };
    });
  },
};

async function verify(
  candidate: Candidate,
  ctx: {
    syllabusText: string;
    outcomes: Array<{ code: string; description: string }>;
    targetBloom: Record<string, number>;
    outcomeWeights?: Record<string, number>;
    input: GeneratePaperInput;
    bankVectors: Map<number, Float32Array> | null;
  }
): Promise<Verification> {
  const violations: string[] = [];
  const total = ctx.input.totalMarks;
  const marksTotal = candidate.questions.reduce((sum, q) => sum + q.marks, 0);
  if (Math.abs(marksTotal - total) > 0.01) violations.push(`Marks sum to ${marksTotal}, must equal ${total}.`);
  if (candidate.questions.length !== ctx.input.questionCount) {
    violations.push(`Produced ${candidate.questions.length} questions, required ${ctx.input.questionCount}.`);
  }
  const knownCodes = new Set(ctx.outcomes.map((o) => o.code));
  for (const q of candidate.questions) {
    if (q.intendedOutcome && !knownCodes.has(q.intendedOutcome)) violations.push(`Q${q.sequenceNumber} cites unknown outcome ${q.intendedOutcome}.`);
  }

  // Verifier 1: the existing question-review analyser (clarity + observed Bloom level).
  const questions = candidate.questions.map((q) => ({ id: q.sequenceNumber, text: q.text, marks: q.marks }));
  const review = await runQuestionReviewPipeline(questions);
  const observedBloomById = new Map(review.questions.map((q) => [q.questionId, q.bloomLevel as BloomLevel]));
  const observedBloom = marksByKey(candidate.questions, (q) => observedBloomById.get(q.sequenceNumber) ?? q.intendedBloom, (q) => q.marks, marksTotal || total);
  const bloomFit = distributionFit(ctx.targetBloom, observedBloom);
  for (const level of BLOOM_LEVELS) {
    const gap = (ctx.targetBloom[level] ?? 0) - (observedBloom[level] ?? 0);
    if (Math.abs(gap) >= 12) violations.push(`${level}: target ${Math.round(ctx.targetBloom[level] ?? 0)}% of marks, observed ${Math.round(observedBloom[level] ?? 0)}% (as classified by the reviewer).`);
  }
  for (const q of review.questions) {
    if (q.clarityScore < 60) violations.push(`Q${q.questionId} clarity ${q.clarityScore}/100: ${q.issues[0] ?? q.reason}`);
  }
  let llmCalls = 1;

  // Verifier 2: CO mapping (only when the course has outcomes).
  let outcomeFit = 100;
  let observedOutcomes: Record<string, number> = {};
  if (ctx.outcomes.length && ctx.outcomeWeights) {
    const co = await runCoMappingPipeline(ctx.syllabusText, questions, ctx.outcomes);
    llmCalls += 1;
    const mapped = new Map(co.questionCOMap.map((m) => [m.questionId, m.courseOutcome]));
    observedOutcomes = marksByKey(candidate.questions, (q) => mapped.get(q.sequenceNumber) ?? null, (q) => q.marks, marksTotal || total);
    outcomeFit = distributionFit(ctx.outcomeWeights, observedOutcomes);
    for (const code of co.missingOutcomes) if ((ctx.outcomeWeights[code] ?? 0) > 0) violations.push(`Outcome ${code} (weight ${Math.round(ctx.outcomeWeights[code])}%) is not assessed by any question.`);
    for (const id of co.unmappedQuestionIds) violations.push(`Q${id} does not map to any course outcome.`);
  }

  // Verifier 3: syllabus coverage.
  const coverage = await runSyllabusCoveragePipeline(ctx.syllabusText, candidate.questions.map((q) => `- ${q.text}`).join("\n"));
  llmCalls += 1;
  const syllabusCoverage = Math.round(coverage.coveragePercentage);
  if (coverage.missingTopics.length > Math.ceil(ctx.input.questionCount / 2)) {
    violations.push(`Syllabus coverage ${syllabusCoverage}%: untouched topics include ${coverage.missingTopics.slice(0, 4).join(", ")}.`);
  }

  // Verifier 4 (model-free): originality against the course bank via embeddings.
  let originality = 100;
  const nearDuplicates: Array<{ sequenceNumber: number; cosine: number }> = [];
  if (ctx.bankVectors && ctx.bankVectors.size) {
    const vectors = await embeddingService.embed(candidate.questions.map((q) => q.text));
    const bank = [...ctx.bankVectors.values()];
    const maxima = vectors.map((v) => bank.reduce((best, b) => Math.max(best, dot(v, b)), -1));
    maxima.forEach((cos, i) => {
      if (cos >= env.embedding.nearDuplicate) nearDuplicates.push({ sequenceNumber: candidate.questions[i].sequenceNumber, cosine: Math.round(cos * 1000) / 1000 });
    });
    const meanMax = maxima.reduce((a, b) => a + b, 0) / maxima.length;
    originality = Math.round(Math.max(0, Math.min(100, (1 - Math.max(0, meanMax - 0.3) / 0.6) * 100)));
    for (const d of nearDuplicates) violations.push(`Q${d.sequenceNumber} is a near-duplicate of an existing bank question (cosine ${d.cosine}); replace it.`);
  }

  const scores: VerifierScores = { clarity: Math.round(review.qualityScore), bloomFit, outcomeFit, syllabusCoverage, originality };
  const objective = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof VerifierScores>).reduce((sum, key) => sum + scores[key] * WEIGHTS[key], 0) / 100
  );
  const hardFail = violations.some((v) => v.startsWith("Marks sum") || v.startsWith("Produced") || v.includes("near-duplicate"));
  return {
    objective,
    passed: objective >= ctx.input.passThreshold && !hardFail,
    scores,
    weights: WEIGHTS,
    violations,
    observedBloom,
    observedOutcomes,
    marksTotal,
    nearDuplicates,
    llmCalls,
  };
}
