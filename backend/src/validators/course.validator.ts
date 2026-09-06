import { z } from "zod";

export const createCourseSchema = z.object({
  courseCode: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  courseName: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
