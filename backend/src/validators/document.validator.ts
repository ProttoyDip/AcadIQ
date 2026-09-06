import { z } from "zod";

const baseUpload = z.object({
  courseId: z.coerce.number().int().positive(),
});

export const syllabusUploadSchema = baseUpload;

export const questionPaperUploadSchema = baseUpload.extend({
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  semester: z.string().trim().min(1).max(50),
});

export const documentUploadSchema = z.discriminatedUnion("documentType", [
  baseUpload.extend({ documentType: z.literal("SYLLABUS") }),
  baseUpload.extend({
    documentType: z.literal("QUESTION_PAPER"),
    year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
    semester: z.string().trim().min(1).max(50),
  }),
]);

export type UploadedDocument = Pick<Express.Multer.File, "path" | "originalname" | "mimetype" | "size">;
