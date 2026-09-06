import { z } from "zod";

export const analyzeExamSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  questionPaperId: z.coerce.number().int().positive(),
});

export const analyzeSyllabusSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  questionPaperId: z.coerce.number().int().positive(),
});

export const analyzeSimilaritySchema = z.object({
  courseId: z.coerce.number().int().positive(),
  currentPaperId: z.coerce.number().int().positive(),
  previousPaperId: z.coerce.number().int().positive(),
});

export const questionReviewSchema = analyzeExamSchema.extend({
  questionIds: z.array(z.coerce.number().int().positive()).min(1).max(100).optional(),
});

export const coMappingSchema = analyzeExamSchema.extend({
  courseOutcomes: z.array(z.object({
    code: z.string().trim().min(1).max(30),
    description: z.string().trim().min(3).max(1000),
  })).min(1).max(30).optional(),
});

export type AnalyzeExamInput = z.infer<typeof analyzeExamSchema>;
export type AnalyzeSyllabusInput = z.infer<typeof analyzeSyllabusSchema>;
export type AnalyzeSimilarityInput = z.infer<typeof analyzeSimilaritySchema>;
export type QuestionReviewInput = z.infer<typeof questionReviewSchema>;
export type CoMappingInput = z.infer<typeof coMappingSchema>;
