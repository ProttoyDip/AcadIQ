import { z } from "zod";

export const copilotChatSchema = z.object({
  sessionId: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive(),
  examId: z.coerce.number().int().positive().optional(),
  reportId: z.coerce.number().int().positive().optional(),
  message: z.string().trim().min(1).max(8000),
});

export type CopilotChatRequest = z.infer<typeof copilotChatSchema>;
