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
