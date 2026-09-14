import { z } from "zod";

const baseUpload = z.object({
  courseId: z.coerce.number().int().positive(),
});

export const CANONICAL_SEMESTERS = ["Spring", "Summer", "Fall", "Winter", "Semester 1", "Semester 2", "Semester 3"] as const;

/**
 * "fall 2024", "FALL", "Autumn", "Sem-1", "1st semester" all collapse to one canonical label so
 * cross-semester trends group correctly. Unknown values are rejected with the accepted list.
 */
export function normalizeSemester(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[\s\-_/]+/g, " ").trim();
  if (/^(spring|spr)$/.test(value)) return "Spring";
  if (/^(summer|sum)$/.test(value)) return "Summer";
  if (/^(fall|autumn|aut)$/.test(value)) return "Fall";
  if (/^(winter|win)$/.test(value)) return "Winter";
  const ordinal = value.match(/^(?:sem(?:ester)?\s*([123])|([123])(?:st|nd|rd)?\s*sem(?:ester)?)$/);
  if (ordinal) return `Semester ${ordinal[1] ?? ordinal[2]}`;
  return null;
}

const semester = z.string().trim().min(1).max(50).transform((value, context) => {
  const canonical = normalizeSemester(value);
  if (!canonical) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unrecognised semester "${value}". Use one of: ${CANONICAL_SEMESTERS.join(", ")} (a year may be appended).`,
    });
    return z.NEVER;
  }
  return canonical;
});

export const syllabusUploadSchema = baseUpload;

export const questionPaperUploadSchema = baseUpload.extend({
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  semester,
});

export const documentUploadSchema = z.discriminatedUnion("documentType", [
  baseUpload.extend({ documentType: z.literal("SYLLABUS") }),
  baseUpload.extend({
    documentType: z.literal("QUESTION_PAPER"),
    year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
    semester,
  }),
]);

export type UploadedDocument = Pick<Express.Multer.File, "path" | "originalname" | "mimetype" | "size">;
