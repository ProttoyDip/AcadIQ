import { prisma } from "../../database/prismaClient";
import { gemmaService } from "../ollama/gemma.service";
import { questionValidatorService, GeneratedQuestionItem } from "./questionValidator.service";
import { AppError } from "../../middleware/error.middleware";

export interface GenerateQuestionsOptions {
  courseText: string;
  documentId?: number;
  userId?: number;
  questionCount?: number;
  questionType?: string; // MCQ | Short Answer | Descriptive | True/False | Viva | Conceptual | Application-based
  difficulty?: string; // Easy | Medium | Hard | Mixed
  topic?: string;
  includeAnswers?: boolean;
  includeExplanations?: boolean;
}

export interface QuestionGenerationResult {
  questions: GeneratedQuestionItem[];
  total: number;
  documentId?: number;
}

export class QuestionGeneratorService {
  /**
   * Generates questions from course outline using Gemma 3 and persists them.
   */
  async generateQuestions(options: GenerateQuestionsOptions): Promise<QuestionGenerationResult> {
    const {
      courseText,
      documentId,
      userId,
      questionCount = 5,
      questionType = "MCQ",
      difficulty = "Medium",
      topic,
      includeAnswers = true,
      includeExplanations = true,
    } = options;

    if (!courseText || courseText.trim().length < 20) {
      throw new AppError("Insufficient course outline text provided for question generation", 400);
    }

    // Limit course outline text to ~20,000 characters to keep local model fast
    const boundedText = courseText.length > 20000 ? courseText.slice(0, 20000) : courseText;

    const topicConstraint = topic ? `Focus specifically on the topic/chapter: "${topic}".` : "";
    const typeConstraint = questionType === "Mixed"
      ? "Generate a balanced mixture of MCQs, Short Answers, Conceptual, and Application-based questions."
      : `Generate exclusively questions of type: "${questionType}".`;

    const answerGuideline = includeAnswers
      ? `Provide the accurate "correctAnswer" for each question.`
      : `Set "correctAnswer" to null.`;

    const explanationGuideline = includeExplanations
      ? `Provide a thorough pedagogical "explanation" justifying the answer.`
      : `Set "explanation" to null.`;

    const mcqRequirement = (questionType === "MCQ" || questionType === "Mixed")
      ? `For any question of type "MCQ", you MUST provide an "options" array containing exactly 4 distinct choices (e.g. ["Option A", "Option B", "Option C", "Option D"]), and "correctAnswer" must exactly match one of the choices.`
      : `For non-MCQ questions, "options" can be omitted or null.`;

    const trueFalseRequirement = questionType === "True/False"
      ? `For True/False questions, "options" must be ["True", "False"], and "correctAnswer" must be either "True" or "False".`
      : "";

    const systemPrompt = `You are AcadIQ's automated Academic Assessment Architect powered by Gemma 3.
Your task is to generate rigorous, high-quality examination questions based SOLELY on the uploaded course material.

CRITICAL RULES:
1. Ground every question strictly in the provided course outline. Do not invent topics outside this syllabus.
2. ${typeConstraint}
3. Target difficulty level: "${difficulty}".
4. ${topicConstraint}
5. ${answerGuideline}
6. ${explanationGuideline}
7. ${mcqRequirement}
8. ${trueFalseRequirement}
9. Generate exactly ${questionCount} questions.

You MUST format your entire response as a single JSON object with a "questions" array matching this exact schema:
{
  "questions": [
    {
      "question": "What is the primary function of ...?",
      "type": "${questionType === "Mixed" ? "MCQ" : questionType}",
      "difficulty": "${difficulty}",
      "topic": "${topic || "General"}",
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctAnswer": "Choice B",
      "explanation": "Explanation here..."
    }
  ]
}
Return valid JSON ONLY. No preamble or markdown commentary.`;

    const userPrompt = `Course Outline Content:
${boundedText}

Generate ${questionCount} questions now.`;

    let rawJson: any;
    try {
      rawJson = await gemmaService.generateJson(userPrompt, systemPrompt, 0.2);
    } catch (err: any) {
      throw new AppError(`AI question generation failed: ${err.message}`, 502);
    }

    // Validate using Zod schema
    const validatedQuestions = questionValidatorService.validateQuestions(rawJson);

    // Save questions to database if documentId or userId is provided
    try {
      if (documentId || userId) {
        await prisma.generatedQuestion.createMany({
          data: validatedQuestions.map((q) => ({
            documentId: documentId || null,
            userId: userId || null,
            topic: q.topic || topic || null,
            difficulty: q.difficulty || difficulty,
            type: q.type,
            question: q.question,
            options: q.options ? q.options : undefined,
            correctAnswer: q.correctAnswer || null,
            explanation: q.explanation || null,
          })),
        });
      }
    } catch {
      // Non-fatal error: questions were generated successfully even if persistence encountered an issue
    }

    return {
      questions: validatedQuestions,
      total: validatedQuestions.length,
      documentId,
    };
  }
}

export const questionGeneratorService = new QuestionGeneratorService();
