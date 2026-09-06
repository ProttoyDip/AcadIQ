import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";

/**
 * Thin wrapper around the LLM provider. Kept provider-agnostic (OpenAI-compatible
 * chat completions endpoint) so the model/vendor can be swapped via env vars only.
 */

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

const API_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function callLlmJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  if (!env.openAiApiKey) {
    throw new AppError("AI provider is not configured (OPENAI_API_KEY missing)", 503);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error("LLM request failed", text);
    throw new AppError("AI analysis request failed", 502);
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body?.choices?.[0]?.message?.content;

  if (!content) {
    throw new AppError("AI provider returned an empty response", 502);
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AppError("AI provider returned malformed JSON", 502);
  }
}
