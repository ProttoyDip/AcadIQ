import { z } from "zod";

export const createCourseSchema = z.object({
  courseCode: z.string().min(2).max(20),
  courseName: z.string().min(2).max(150),
  description: z.string().max(2000).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
