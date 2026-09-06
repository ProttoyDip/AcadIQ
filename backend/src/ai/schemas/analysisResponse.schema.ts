import { z } from "zod";

const score = z.number().min(0).max(100);
const nonEmpty = z.string().trim().min(1);
const bloomLevel = z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const explanationSchema = z.object({
  decision: nonEmpty.max(191),
  reason: nonEmpty,
  confidence: score,
}).strict();

export const examQualityResponseSchema = z.object({
  qualityScore: score,
  coverage: z.object({
    percentage: score,
    topics: z.array(z.object({
      topic: nonEmpty,
      coveredInExam: z.boolean(),
      questionCount: z.number().int().min(0),
      marksAllocated: z.number().min(0),
      reason: nonEmpty,
    })),
    courseOutcomes: z.array(z.object({ outcome: nonEmpty, addressed: z.boolean(), reason: nonEmpty })),
  }),
  difficulty: z.array(z.object({
    level: z.enum(["EASY", "MODERATE", "HARD"]),
    questionCount: z.number().int().min(0),
    marksAllocated: z.number().min(0),
    percentage: score,
    reason: nonEmpty,
  })),
  bloomDistribution: z.array(z.object({
    level: bloomLevel,
    questionCount: z.number().int().min(0),
    marksAllocated: z.number().min(0),
    percentage: score,
    reason: nonEmpty,
  })),
  marksDistribution: z.array(z.object({ topic: nonEmpty, marks: z.number().min(0), percentage: score })),
  scoreFactors: z.array(z.object({ factor: nonEmpty, score, weight: score, reason: nonEmpty })).min(1),
  positivePoints: z.array(nonEmpty),
  issues: z.array(z.object({ severity: priority, message: nonEmpty, reason: nonEmpty })),
  recommendations: z.array(z.object({ message: nonEmpty, priority })),
  explanation: explanationSchema,
}).strict().superRefine((value, context) => {
  const totalWeight = value.scoreFactors.reduce((sum, factor) => sum + factor.weight, 0);
  if (Math.abs(totalWeight - 100) > 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Score factor weights must total 100",
      path: ["scoreFactors"],
    });
    return;
  }
  const weightedScore = value.scoreFactors.reduce(
    (sum, factor) => sum + factor.score * factor.weight,
    0
  ) / totalWeight;
  if (Math.abs(weightedScore - value.qualityScore) > 5) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Quality score is not supported by the weighted score factors",
      path: ["qualityScore"],
    });
  }
});

export const syllabusCoverageResponseSchema = z.object({
  coveredTopics: z.array(nonEmpty),
  missingTopics: z.array(nonEmpty),
  overusedTopics: z.array(z.object({ topic: nonEmpty, occurrences: z.number().int().min(1) })),
  coveragePercentage: score,
  explanation: explanationSchema,
}).strict();

export const questionSimilarityResponseSchema = z.object({
  matches: z.array(z.object({
    currentQuestionId: z.number().int().positive(),
    previousQuestionId: z.number().int().positive(),
    similarityPercentage: score,
    matchType: z.enum(["DUPLICATE", "SIMILAR_CONCEPT", "REPEATED_PATTERN"]),
    reason: nonEmpty,
    confidence: score,
  })),
  overallDuplicationPercentage: score,
  recommendation: nonEmpty,
  explanation: explanationSchema,
}).strict();

export const academicMemoryResponseSchema = z.object({
  similarQuestions: z.array(z.object({
    newQuestionId: z.number().int().positive(),
    historicalQuestionId: z.number().int().positive(),
    similarityScore: score,
    reason: nonEmpty,
    confidence: score,
    replacementSuggestion: nonEmpty,
  })),
  similarityScore: score,
  replacementSuggestion: nonEmpty,
  explanation: explanationSchema,
}).strict();

export const questionReviewResponseSchema = z.object({
  qualityScore: score,
  questions: z.array(z.object({
    questionId: z.number().int().positive(),
    clarityScore: score,
    bloomLevel,
    decision: nonEmpty.max(191),
    reason: nonEmpty,
    confidence: score,
    issues: z.array(nonEmpty),
    suggestedRewrite: nonEmpty.optional(),
  })),
  issues: z.array(z.object({
    severity: priority,
    message: nonEmpty,
    questionId: z.number().int().positive().optional(),
  })),
  recommendations: z.array(z.object({ message: nonEmpty, priority })),
  explanation: explanationSchema,
}).strict();

export const coMappingResponseSchema = z.object({
  qualityScore: score,
  courseOutcomes: z.array(z.object({ code: nonEmpty.max(30), description: nonEmpty })).min(1),
  questionCOMap: z.array(z.object({
    questionId: z.number().int().positive(),
    courseOutcome: nonEmpty.max(30),
    strength: z.enum(["WEAK", "MODERATE", "STRONG"]),
    decision: nonEmpty.max(191),
    reason: nonEmpty,
    confidence: score,
  })),
  coverage: z.record(score),
  coveragePercentage: score,
  missingOutcomes: z.array(nonEmpty.max(30)),
  unmappedQuestionIds: z.array(z.number().int().positive()),
  issues: z.array(z.object({ severity: priority, message: nonEmpty })),
  recommendations: z.array(z.object({ message: nonEmpty, priority })),
  explanation: explanationSchema,
}).strict();
