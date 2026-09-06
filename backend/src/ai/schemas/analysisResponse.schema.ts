import { z } from "zod";

const bloomLevel = z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const examQualityResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  topicCoverage: z.array(
    z.object({
      topic: z.string(),
      coveredInExam: z.boolean(),
      questionCount: z.number().int().min(0),
      marksAllocated: z.number().min(0),
    })
  ),
  bloomDistribution: z.array(
    z.object({
      level: bloomLevel,
      questionCount: z.number().int().min(0),
      marksAllocated: z.number().min(0),
      percentage: z.number().min(0).max(100),
    })
  ),
  marksDistribution: z.array(z.object({ topic: z.string(), marks: z.number(), percentage: z.number() })),
  learningOutcomeAlignment: z.array(z.object({ outcome: z.string(), addressed: z.boolean() })),
  recommendations: z.array(z.object({ message: z.string(), priority })),
});

export const syllabusCoverageResponseSchema = z.object({
  coveredTopics: z.array(z.string()),
  missingTopics: z.array(z.string()),
  overusedTopics: z.array(z.object({ topic: z.string(), occurrences: z.number().int() })),
  coveragePercentage: z.number().min(0).max(100),
});

export const questionSimilarityResponseSchema = z.object({
  matches: z.array(
    z.object({
      currentQuestionId: z.number(),
      previousQuestionId: z.number(),
      similarityPercentage: z.number().min(0).max(100),
      matchType: z.enum(["DUPLICATE", "SIMILAR_CONCEPT", "REPEATED_PATTERN"]),
    })
  ),
  overallDuplicationPercentage: z.number().min(0).max(100),
  recommendation: z.string(),
});

export const questionReviewResponseSchema = z.object({
  qualityScore: z.number().min(0).max(100),
  questions: z.array(z.object({
    questionId: z.number().int().positive(),
    clarityScore: z.number().min(0).max(100),
    bloomLevel,
    issues: z.array(z.string().min(1)),
    suggestedRewrite: z.string().min(1).optional(),
  })),
  issues: z.array(z.object({
    severity: priority,
    message: z.string().min(1),
    questionId: z.number().int().positive().optional(),
  })),
  recommendations: z.array(z.object({ message: z.string().min(1), priority })),
});

export const coMappingResponseSchema = z.object({
  qualityScore: z.number().min(0).max(100),
  coverage: z.record(z.number().min(0).max(100)),
  mappings: z.array(z.object({
    questionId: z.number().int().positive(),
    courseOutcome: z.string().min(1),
    strength: z.enum(["WEAK", "MODERATE", "STRONG"]),
    rationale: z.string().min(1),
  })),
  unmappedQuestionIds: z.array(z.number().int().positive()),
  issues: z.array(z.object({ severity: priority, message: z.string().min(1) })),
  recommendations: z.array(z.object({ message: z.string().min(1), priority })),
});
