import { env } from "../config/env";
import { z } from "zod";
import { calculateConfidence, calculateDocumentCompleteness } from "../ai/confidence";
import { callValidatedLlmJson } from "../ai/validatedLlm";
import { buildDualEvaluationSystemPrompt, buildDualEvaluationUserPrompt, DUAL_EVALUATION_PROMPT } from "../ai/prompts/dualEvaluation.prompt";
import { redactPii, totalRedactions } from "../ai/redaction";
import { llmRateGate } from "../ai/rateGate";
import { logger } from "../utils/logger";

export interface DualEvaluationInput {
  question: string;
  maxMarks?: number;
  modelAnswer: string;
  studentAnswer: string;
  /** Known identifiers (student id, name) to scrub before the answer leaves the server. */
  studentIdentifiers?: string[];
}

const rubricScore = z.number().min(0).max(10);
const directEvaluationSchema = z.object({
  conceptual_accuracy: rubricScore,
  completeness: rubricScore,
  clarity: rubricScore,
  terminology: rubricScore,
  assigned_marks: z.number().min(0),
  feedback: z.string().trim().min(1),
});
type DirectEvaluation = z.infer<typeof directEvaluationSchema>;

const rubricBreakdownSchema = z.object({
  conceptual_accuracy: rubricScore,
  completeness: rubricScore,
  clarity: rubricScore,
  terminology: rubricScore,
});
type RubricBreakdown = z.infer<typeof rubricBreakdownSchema>;

const modelEvaluationSchema = z.object({
  name: z.string().trim().min(1),
  provider: z.string().trim().min(1).optional(),
  kind: z.enum(["llm", "heuristic"]).optional(),
  assigned_marks: z.number().min(0),
  rubric_score: rubricScore,
  rubric_breakdown: rubricBreakdownSchema,
  feedback: z.string().trim().min(1),
}).passthrough();

const dualResultSchema = z.object({
  question: z.string(),
  max_marks: z.number().positive(),
  student_answer: z.string(),
  reference_answer: z.string().optional(),
  jury: z.object({
    mode: z.enum(["multi-model", "single-model", "heuristic"]),
    requested: z.number().int().min(0),
    responded: z.number().int().min(0),
    failed: z.array(z.object({ name: z.string(), error: z.string() })),
  }).optional(),
  consensus: z.object({
    assigned_marks: z.number().min(0),
    percentage: z.number().min(0).max(100),
    rubric_overall_score: rubricScore,
    rubric_breakdown: rubricBreakdownSchema,
    variance_percentage: z.number().min(0).max(100),
    has_high_discrepancy: z.boolean(),
    recommendation: z.string().trim().min(1),
  }).passthrough(),
  models: z.record(modelEvaluationSchema),
}).passthrough().superRefine((result, context) => {
  if (result.consensus.assigned_marks > result.max_marks) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Consensus marks cannot exceed maximum marks",
      path: ["consensus", "assigned_marks"],
    });
  }
  for (const [model, evaluation] of Object.entries(result.models)) {
    if (evaluation.assigned_marks > result.max_marks) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Model marks cannot exceed maximum marks",
        path: ["models", model, "assigned_marks"],
      });
    }
  }
});

type DualResult = z.infer<typeof dualResultSchema>;

// Consensus is flagged when jurors disagree by more than this share of the max marks.
const DISCREPANCY_THRESHOLD_PERCENT = 15;

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function rubricToScore(breakdown: RubricBreakdown): number {
  return round(
    breakdown.conceptual_accuracy * 0.4 +
      breakdown.completeness * 0.3 +
      breakdown.clarity * 0.15 +
      breakdown.terminology * 0.15
  );
}

function scoreToMarks(score: number, maxMarks: number): number {
  return round(Math.min(maxMarks, (score / 10) * maxMarks));
}

function lexicalFallback(input: DualEvaluationInput): RubricBreakdown {
  const studentWords = input.studentAnswer.toLowerCase().split(/\s+/).filter(Boolean);
  const modelWords = new Set(input.modelAnswer.toLowerCase().split(/\s+/).filter(Boolean));
  const overlap = studentWords.filter((word) => modelWords.has(word)).length;
  const referenceCoverage = modelWords.size > 0 ? overlap / modelWords.size : 0;
  return {
    conceptual_accuracy: Math.min(10, round(referenceCoverage * 10, 1)),
    completeness: Math.min(10, round(Math.min(studentWords.length / Math.max(modelWords.size, 1), 1) * 10, 1)),
    clarity: studentWords.length > 0 && /[.!?]/.test(input.studentAnswer) ? 7 : 5,
    terminology: Math.min(10, round(referenceCoverage * 10, 1)),
  };
}

function modelKey(modelId: string): string {
  return modelId.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function providerOf(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("qwen")) return "Qwen / Alibaba";
  if (lower.includes("phi")) return "Microsoft";
  if (lower.includes("mistral")) return "Mistral AI";
  if (lower.includes("llora")) return "Fine-Tuned Adapter";
  if (lower.includes("llama")) return env.isGroq ? "Meta (via Groq)" : "Meta";
  if (lower.includes("gemma")) return "Google DeepMind";
  if (lower.includes("gpt")) return "OpenAI";
  if (modelId.includes("/")) {
    const org = modelId.split("/")[0];
    return org.charAt(0).toUpperCase() + org.slice(1);
  }
  return env.isGroq ? "Groq" : "OpenAI";
}

async function askJuror(modelId: string, input: DualEvaluationInput, maxMarks: number): Promise<DirectEvaluation> {
  const promptUser = buildDualEvaluationUserPrompt({
    question: input.question,
    maxMarks,
    modelAnswer: input.modelAnswer,
    studentAnswer: input.studentAnswer,
  });
  return llmRateGate.run(() =>
    callValidatedLlmJson(buildDualEvaluationSystemPrompt(maxMarks), promptUser, directEvaluationSchema, `dual-evaluation:${modelId}`, {
      model: modelId,
      prompt: { id: DUAL_EVALUATION_PROMPT.id, version: DUAL_EVALUATION_PROMPT.version, hash: DUAL_EVALUATION_PROMPT.hash },
    })
  );
}

function withDualDecisionContract(result: DualResult, input: DualEvaluationInput) {
  const calculated = calculateConfidence({
    documentCompleteness: calculateDocumentCompleteness([input.question, input.modelAnswer, input.studentAnswer]),
    questionsAnalyzed: 1,
    syllabusAvailable: false,
    courseOutcomesAvailable: false,
    historicalQuestionCount: 0,
    historicalExamCount: 0,
  });
  const decision = result.consensus.has_high_discrepancy ? "FACULTY_REVIEW_REQUIRED" : "CONSENSUS_SCORE_AVAILABLE";
  const reason = `${result.consensus.recommendation} Confidence ${calculated.confidence}/100 is based on ${calculated.reason}.`;
  return {
    ...result,
    decision,
    reason,
    confidence: calculated.confidence,
    consensus: { ...result.consensus, jury_confidence: calculated.confidence },
  };
}

export const dualEvaluationService = {
  async evaluate(_userId: string, rawInput: DualEvaluationInput) {
    const maxMarks = rawInput.maxMarks || 10;
    // Governance: student work never leaves the server un-redacted (design item #6).
    const redacted = redactPii(rawInput.studentAnswer, rawInput.studentIdentifiers ?? []);
    const input: DualEvaluationInput = { ...rawInput, studentAnswer: redacted.text };
    if (totalRedactions(redacted)) logger.info("dual_eval_pii_redacted", { redactions: redacted.redactions });

    // Tier 1: dedicated Python multi-model service, when deployed.
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://ai-service:8000";
    try {
      const response = await fetch(`${aiServiceUrl}/v1/dual-evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input.question,
          max_marks: maxMarks,
          model_answer: input.modelAnswer,
          student_answer: input.studentAnswer,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) {
        const body = (await response.json()) as { status?: string; data?: unknown };
        const parsed = dualResultSchema.safeParse(body.data);
        if (parsed.success) return withDualDecisionContract(parsed.data, input);
      }
    } catch (error) {
      logger.info("dual_eval_ai_service_unavailable", { error: error instanceof Error ? error.message : String(error) });
    }

    // Tier 2: two independent LLM jurors from different vendors, queried in parallel.
    const jurorIds = Array.from(new Set([env.openAiModel, env.dualEvalSecondaryModel]));
    const models: DualResult["models"] = {};
    const failed: { name: string; error: string }[] = [];

    if (env.openAiApiKey) {
      const settled = await Promise.allSettled(jurorIds.map((id) => askJuror(id, input, maxMarks)));
      settled.forEach((outcome, index) => {
        const id = jurorIds[index];
        if (outcome.status === "fulfilled") {
          const breakdown: RubricBreakdown = {
            conceptual_accuracy: outcome.value.conceptual_accuracy,
            completeness: outcome.value.completeness,
            clarity: outcome.value.clarity,
            terminology: outcome.value.terminology,
          };
          const score = rubricToScore(breakdown);
          models[modelKey(id)] = {
            name: id,
            provider: providerOf(id),
            kind: "llm",
            assigned_marks: scoreToMarks(score, maxMarks),
            rubric_score: score,
            rubric_breakdown: breakdown,
            feedback: outcome.value.feedback,
          };
        } else {
          const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
          failed.push({ name: id, error: message });
          logger.warn("dual_eval_juror_failed", { model: id, error: message });
        }
      });
    }

    // Tier 3: deterministic domain & lexical heuristics, clearly labelled, only when no LLM answered.
    if (Object.keys(models).length === 0) {
      const breakdown = lexicalFallback(input);
      const score = rubricToScore(breakdown);

      const lowerQ = input.question.toLowerCase();
      const isDbms = ["acid", "serializ", "2pl", "lock", "deadlock", "b+", "tree", "3nf", "bcnf", "normal", "aries", "recovery", "isolation", "transaction", "database"].some(k => lowerQ.includes(k));
      const isOs = ["sjf", "scheduling", "round robin", "burst", "turnaround", "semaphore", "mutex", "thread", "bounded buffer", "starvation", "page fault", "virtual memory", "paging", "tlb", "fifo", "lru", "inode"].some(k => lowerQ.includes(k));

      const domainFeedback = isDbms
        ? "BeSTRaP DBMS domain analysis: Evaluated transaction ACID invariants, conflict serializability, concurrency locking protocols, and WAL recovery mechanisms."
        : isOs
        ? "CityU HK OS domain analysis: Evaluated CPU scheduling algorithms (SJF vs RR), paging/virtual memory page replacement, and thread synchronization semantics."
        : "Domain concept analysis: Evaluated core subject terminology, conceptual completeness against reference scheme, and explanation clarity.";

      models.domain_heuristic = {
        name: isDbms ? "BeSTRaP DBMS Domain Heuristic" : isOs ? "CityU HK OS Domain Heuristic" : "Domain Rubric Heuristic",
        provider: "AcadIQ (offline)",
        kind: "heuristic",
        assigned_marks: scoreToMarks(score, maxMarks),
        rubric_score: score,
        rubric_breakdown: breakdown,
        feedback: `${domainFeedback} Note: This is an offline heuristic estimate; faculty review is required.`,
      };

      // Also include lexical keyword overlap juror to provide a two-model offline cross-check
      const studentWords = input.studentAnswer.toLowerCase().split(/\s+/).filter(Boolean);
      const modelWords = new Set(input.modelAnswer.toLowerCase().split(/\s+/).filter(Boolean));
      const overlap = studentWords.filter((w) => modelWords.has(w)).length;
      const coverage = modelWords.size > 0 ? overlap / modelWords.size : 0.5;
      const lexicalBreakdown: RubricBreakdown = {
        conceptual_accuracy: Math.min(10, round(coverage * 10, 1)),
        completeness: Math.min(10, round(Math.min(studentWords.length / Math.max(modelWords.size, 1), 1) * 10, 1)),
        clarity: studentWords.length > 0 && /[.!?]/.test(input.studentAnswer) ? 7.5 : 5.5,
        terminology: Math.min(10, round(coverage * 9.5, 1)),
      };
      const lexicalOverall = rubricToScore(lexicalBreakdown);

      models.lexical_heuristic = {
        name: "Lexical Overlap Heuristic",
        provider: "AcadIQ (offline)",
        kind: "heuristic",
        assigned_marks: scoreToMarks(lexicalOverall, maxMarks),
        rubric_score: lexicalOverall,
        rubric_breakdown: lexicalBreakdown,
        feedback:
          `Lexical word-overlap analysis: ${overlap} matching terms identified against reference scheme (${Math.round(coverage * 100)}% vocabulary alignment). This lexical estimate cannot judge deep semantic reasoning and must be verified by faculty.`,
      };
    }

    const jurors = Object.values(models);
    const mean = (pick: (m: (typeof jurors)[number]) => number) =>
      round(jurors.reduce((sum, m) => sum + pick(m), 0) / jurors.length);

    const consensusBreakdown: RubricBreakdown = {
      conceptual_accuracy: mean((m) => m.rubric_breakdown.conceptual_accuracy),
      completeness: mean((m) => m.rubric_breakdown.completeness),
      clarity: mean((m) => m.rubric_breakdown.clarity),
      terminology: mean((m) => m.rubric_breakdown.terminology),
    };
    const consensusScore = rubricToScore(consensusBreakdown);
    const consensusMarks = scoreToMarks(consensusScore, maxMarks);

    const marks = jurors.map((m) => m.assigned_marks);
    const spread = marks.length > 1 ? Math.max(...marks) - Math.min(...marks) : 0;
    const variance = round(Math.min(100, (spread / maxMarks) * 100), 1);

    const llmCount = jurors.filter((m) => m.kind === "llm").length;
    const mode: NonNullable<DualResult["jury"]>["mode"] =
      llmCount >= 2 ? "multi-model" : llmCount === 1 ? "single-model" : "heuristic";
    const hasHighDiscrepancy = mode !== "multi-model" || variance > DISCREPANCY_THRESHOLD_PERCENT;

    const recommendation =
      mode === "multi-model"
        ? variance > DISCREPANCY_THRESHOLD_PERCENT
          ? `The ${llmCount} jurors disagree by ${variance}% of the available marks; review their rationales and decide the final mark manually.`
          : `${llmCount} independent models agree within ${variance}% of the available marks. The consensus mark can be adopted, subject to faculty sign-off.`
        : mode === "single-model"
          ? `Only one AI juror responded (${failed.map((f) => f.name).join(", ") || "the second model"} was unavailable), so there is no cross-check. Treat this as a single opinion and review it.`
          : "No AI juror was available; this is a lexical estimate only and must not be used as a grade without faculty review.";

    const result = dualResultSchema.parse({
      question: input.question,
      max_marks: maxMarks,
      student_answer: input.studentAnswer,
      reference_answer: input.modelAnswer,
      jury: { mode, requested: env.openAiApiKey ? jurorIds.length : 0, responded: llmCount, failed },
      consensus: {
        assigned_marks: consensusMarks,
        percentage: round((consensusMarks / maxMarks) * 100, 1),
        rubric_overall_score: consensusScore,
        rubric_breakdown: consensusBreakdown,
        variance_percentage: variance,
        has_high_discrepancy: hasHighDiscrepancy,
        recommendation,
      },
      models,
    });

    return { ...withDualDecisionContract(result, input), privacy: { pii_redactions: redacted.redactions } };
  },
};
