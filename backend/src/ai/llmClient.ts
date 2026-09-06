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

export async function callLlmJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  if (!env.openAiApiKey) {
    throw new AppError("AI provider is not configured (OPENAI_API_KEY or GROQ_API_KEY missing)", 503);
  }

  if (userPrompt.length > env.maxAiInputChars) {
    throw new AppError("Document content is too large for analysis", 413, { maxCharacters: env.maxAiInputChars });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(env.openAiBaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: env.openAiModel,
          messages,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
    } catch (error) {
      if (attempt === 2) {
        logger.error("llm_transport_failed", { error: error instanceof Error ? error.message : String(error) });
        throw new AppError("AI provider is unavailable", 502);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    if (response.ok || (response.status < 500 && response.status !== 429)) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  if (!response || !response.ok) {
    logger.error("llm_request_failed", { statusCode: response?.status });
    throw new AppError("AI analysis request failed", 502);
  }

  let body: { choices?: { message?: { content?: string } }[] };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new AppError("AI provider returned an unreadable response", 502);
  }
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
