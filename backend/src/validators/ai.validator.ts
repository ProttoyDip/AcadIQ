import { z } from "zod";

export const pdfSummarizeSchema = z.object({
  documentId: z.coerce.number().int().positive("Document ID must be a positive integer"),
  type: z
    .enum(["short", "detailed", "key_points", "important_concepts", "topic_summary"])
    .default("detailed"),
});

export const pdfAskSchema = z.object({
  documentId: z.coerce.number().int().positive("Document ID must be a positive integer"),
  question: z.string().min(2, "Question cannot be empty").max(1000, "Question is too long"),
});

export const imageAnalyzeSchema = z.object({
  question: z.string().max(1000).optional().default("What is shown in this image? Provide an educational breakdown."),
});

export const courseGenerateQuestionsSchema = z.object({
  documentId: z.coerce.number().int().positive().optional(),
  courseText: z.string().min(20).optional(),
  questionCount: z.coerce.number().int().min(1).max(30).default(5),
  questionType: z
    .enum([
      "MCQ",
      "Short Answer",
      "Descriptive",
      "True/False",
      "Viva",
      "Conceptual",
      "Application-based",
      "Mixed",
    ])
    .default("MCQ"),
  difficulty: z.enum(["Easy", "Medium", "Hard", "Mixed"]).default("Medium"),
  topic: z.string().max(200).optional(),
  includeAnswers: z.preprocess((val) => val === true || val === "true", z.boolean().default(true)),
  includeExplanations: z.preprocess((val) => val === true || val === "true", z.boolean().default(true)),
});
