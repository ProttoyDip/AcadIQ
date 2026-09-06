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

export type AnalyzeExamInput = z.infer<typeof analyzeExamSchema>;
export type AnalyzeSyllabusInput = z.infer<typeof analyzeSyllabusSchema>;
export type AnalyzeSimilarityInput = z.infer<typeof analyzeSimilaritySchema>;
