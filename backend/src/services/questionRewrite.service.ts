import { z } from "zod";
import { prisma } from "../database/prismaClient";
import { AppError } from "../middleware/error.middleware";
import { runLlmAnalysis } from "../ai/runner";
import { QUESTION_REWRITE_PROMPT } from "../ai/prompts/facultyWorkflows.prompt";
import { questionRewriteResponseSchema } from "../ai/schemas/facultyWorkflows.schema";
import { documentRepository } from "../repositories/document.repository";
import { fitSyllabusToPrompt } from "./analysisContext.service";
import { tracedAnalysis } from "./traced";

const BLOOM = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;

export const rewriteQuestionSchema = z
  .object({
    /** Either a stored question… */
    questionId: z.coerce.number().int().positive().optional(),
    /** …or ad-hoc text. */
    text: z.string().trim().min(5).max(4000).optional(),
    marks: z.coerce.number().min(0).max(500).optional(),
    mode: z.enum(["RAISE_BLOOM", "VARIANT", "CLARIFY", "SPLIT", "CUSTOM"]),
    targetBloom: z.enum(BLOOM).optional(),
    instruction: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.questionId || v.text, { message: "Provide questionId or text" })
  .refine((v) => v.mode !== "RAISE_BLOOM" || v.targetBloom, { message: "targetBloom is required for RAISE_BLOOM", path: ["targetBloom"] })
  .refine((v) => v.mode !== "CUSTOM" || v.instruction, { message: "instruction is required for CUSTOM", path: ["instruction"] });
export type RewriteQuestionInput = z.infer<typeof rewriteQuestionSchema>;

export const questionRewriteService = {
  rewrite(facultyId: number, input: RewriteQuestionInput) {
    return tracedAnalysis(async () => {
      let text = input.text ?? "";
      let marks = input.marks ?? 10;
      let currentBloom: string | null = null;
      let syllabusExcerpt: string | undefined;

      if (input.questionId) {
        const question = await prisma.question.findFirst({
          where: { id: input.questionId, paper: { course: { facultyId } } },
          select: { questionText: true, marks: true, bloomLevel: true, paper: { select: { courseId: true } } },
        });
        if (!question) throw new AppError("Question not found", 404);
        text = question.questionText;
        marks = input.marks ?? Number(question.marks);
        currentBloom = question.bloomLevel;
        const syllabus = await documentRepository.findLatestSyllabus(question.paper.courseId);
        if (syllabus?.extractedText) syllabusExcerpt = fitSyllabusToPrompt(syllabus.extractedText, 3_000);
      }

      const { consensus } = await runLlmAnalysis(
        QUESTION_REWRITE_PROMPT,
        [{ text, marks, currentBloom, mode: input.mode, targetBloom: input.targetBloom, instruction: input.instruction, syllabusExcerpt }],
        questionRewriteResponseSchema,
        { temperature: input.mode === "VARIANT" ? 0.7 : 0.4 }
      );
      return { original: { text, marks, bloomLevel: currentBloom }, mode: input.mode, targetBloom: input.targetBloom ?? null, variants: consensus.variants };
    });
  },
};
