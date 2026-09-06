import { z } from "zod";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";
import { callLlmJson } from "./llmClient";

const MAX_VALIDATION_ATTEMPTS = 2;

function validationSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
    .join("; ");
}

/**
 * Validates before any AI output can reach persistence. A schema failure gets
 * one constrained repair attempt; repeated failure is rejected, never stored.
 */
export async function callValidatedLlmJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  pipeline: string
): Promise<T> {
  let recoveryPrompt = userPrompt;

  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt += 1) {
    const raw = await callLlmJson<unknown>(systemPrompt, recoveryPrompt);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;

    logger.warn("llm_response_validation_failed", {
      pipeline,
      attempt,
      issues: validationSummary(parsed.error),
    });

    recoveryPrompt = `${userPrompt}\n\nRECOVERY INSTRUCTION: Your previous JSON failed validation: ${validationSummary(parsed.error)}. Return a complete corrected JSON object matching the system schema. Do not add prose or markdown.`;
  }

  throw new AppError("AI response failed validation after recovery", 502, {
    decision: "ANALYSIS_UNAVAILABLE",
    reason: `The ${pipeline} response remained invalid after ${MAX_VALIDATION_ATTEMPTS} validation attempts and was not stored.`,
    confidence: 0,
  });
}
