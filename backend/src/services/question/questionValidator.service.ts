import { z } from "zod";
import { AppError } from "../../middleware/error.middleware";

export const QuestionTypeSchema = z.enum([
  "MCQ",
  "Short Answer",
  "Descriptive",
  "True/False",
  "Viva",
  "Conceptual",
  "Application-based",
]);

export type ValidQuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionDifficultySchema = z.enum(["Easy", "Medium", "Hard", "Mixed"]);
export type ValidQuestionDifficulty = z.infer<typeof QuestionDifficultySchema>;

export const GeneratedQuestionItemSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters long"),
  type: QuestionTypeSchema,
  difficulty: z.string().default("Medium"),
  topic: z.string().optional().nullable(),
  options: z.array(z.string()).optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
});

export type GeneratedQuestionItem = z.infer<typeof GeneratedQuestionItemSchema>;

export const GeneratedQuestionListSchema = z.object({
  questions: z.array(GeneratedQuestionItemSchema).min(1, "At least one question is required"),
});

export class QuestionValidatorService {
  /**
   * Normalizes and validates raw LLM output into typed question items.
   */
  validateQuestions(data: any): GeneratedQuestionItem[] {
    if (!data) {
      throw new AppError("Question generation returned empty response", 502);
    }

    // Handle case where LLM returned direct array instead of { questions: [...] }
    const payload = Array.isArray(data) ? { questions: data } : data;

    const parsed = GeneratedQuestionListSchema.safeParse(payload);
    if (!parsed.success) {
      // If validation fails, try tolerant normalization
      if (Array.isArray(payload.questions)) {
        const repaired: GeneratedQuestionItem[] = [];
        for (const rawQ of payload.questions) {
          if (!rawQ || typeof rawQ !== "object") continue;
          const qText = String(rawQ.question || rawQ.text || "").trim();
          if (!qText) continue;

          let qType: ValidQuestionType = "Short Answer";
          const rawType = String(rawQ.type || "").toUpperCase();
          if (rawType.includes("MCQ") || rawType.includes("CHOICE")) qType = "MCQ";
          else if (rawType.includes("TRUE") || rawType.includes("FALSE")) qType = "True/False";
          else if (rawType.includes("VIVA") || rawType.includes("ORAL")) qType = "Viva";
          else if (rawType.includes("DESCRIPTIVE")) qType = "Descriptive";
          else if (rawType.includes("CONCEPT")) qType = "Conceptual";
          else if (rawType.includes("APPLICATION")) qType = "Application-based";

          let options: string[] | undefined;
          if (Array.isArray(rawQ.options)) {
            options = rawQ.options.map(String).filter(Boolean);
          } else if (qType === "True/False") {
            options = ["True", "False"];
          }

          repaired.push({
            question: qText,
            type: qType,
            difficulty: String(rawQ.difficulty || "Medium"),
            topic: rawQ.topic ? String(rawQ.topic) : undefined,
            options: options && options.length > 0 ? options : undefined,
            correctAnswer: rawQ.correctAnswer ? String(rawQ.correctAnswer) : undefined,
            explanation: rawQ.explanation ? String(rawQ.explanation) : undefined,
          });
        }

        if (repaired.length > 0) {
          return repaired;
        }
      }

      throw new AppError(
        `Failed to validate generated questions: ${parsed.error.errors[0]?.message || "Schema mismatch"}`,
        502,
        { validationErrors: parsed.error.format() }
      );
    }

    return parsed.data.questions;
  }
}

export const questionValidatorService = new QuestionValidatorService();
