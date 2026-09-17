import { z } from "zod";

export const copilotChatSchema = z.object({
  sessionId: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive(),
  examId: z.coerce.number().int().positive().optional(),
  reportId: z.coerce.number().int().positive().optional(),
  message: z.string().trim().min(1).max(8000),
});

export type CopilotChatRequest = z.infer<typeof copilotChatSchema>;

/**
 * Same context as a typed turn, minus `message` — that arrives as audio and is
 * filled in by transcription. Values come from multipart fields, so they are
 * strings on the wire and coerced here.
 */
export const copilotVoiceSchema = copilotChatSchema.omit({ message: true }).extend({
  /** Optional ISO-639-1 hint. Left unset, Whisper auto-detects, which handles
   *  the Bengali/English code-switching faculty actually use. */
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/i, "language must be a two-letter code")
    .optional(),
});

export type CopilotVoiceRequest = z.infer<typeof copilotVoiceSchema>;

/**
 * Dictation into a form field: audio in, text out, no retrieval and no model
 * call beyond transcription. Kept separate from the voice Copilot because it
 * needs no course context and costs a fraction as much.
 */
export const transcribeSchema = z.object({
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/i, "language must be a two-letter code")
    .optional(),
});

export type TranscribeRequest = z.infer<typeof transcribeSchema>;
