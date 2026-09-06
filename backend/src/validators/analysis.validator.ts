import { z } from "zod";

const courseOutcomeInput = z.object({
  code: z.string().trim().min(1).max(30),
  description: z.string().trim().min(3).max(1000),
});

export const analyzeExamSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  questionPaperId: z.coerce.number().int().positive(),
  courseOutcomes: z.array(courseOutcomeInput).min(1).max(30).optional(),
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

export const coMappingSchema = analyzeExamSchema;

export const dualEvaluationSchema = z.object({
  question: z.string().trim().min(3).max(10_000),
  maxMarks: z.coerce.number().positive().max(1_000).default(10),
  modelAnswer: z.string().trim().min(3).max(60_000),
  studentAnswer: z.string().trim().min(1).max(60_000),
});

const questionTextInput = z.object({
  id: z.coerce.number().int().positive().optional(),
  text: z.string().trim().min(3).max(60_000),
});

export const memoryCheckSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  questionPaperId: z.coerce.number().int().positive().optional(),
  newQuestions: z.array(questionTextInput).min(1).max(100).optional(),
  historicalQuestions: z.array(questionTextInput.extend({
    semester: z.string().trim().min(1).max(50),
    year: z.coerce.number().int().min(1900).max(2200),
  })).min(1).max(500).optional(),
  similarityThreshold: z.coerce.number().min(0).max(100).default(40),
}).superRefine((value, context) => {
  if (!value.questionPaperId && !value.newQuestions) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "questionPaperId or newQuestions is required",
      path: ["questionPaperId"],
    });
  }
});

export type AnalyzeExamInput = z.infer<typeof analyzeExamSchema>;
export type AnalyzeSyllabusInput = z.infer<typeof analyzeSyllabusSchema>;
export type AnalyzeSimilarityInput = z.infer<typeof analyzeSimilaritySchema>;
export type QuestionReviewInput = z.infer<typeof questionReviewSchema>;
export type CoMappingInput = z.infer<typeof coMappingSchema>;
export type MemoryCheckInput = z.infer<typeof memoryCheckSchema>;
export type DualEvaluationInput = z.infer<typeof dualEvaluationSchema>;
