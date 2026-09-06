import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";

/**
 * Thin wrapper around the LLM provider. Kept provider-agnostic (OpenAI-compatible
 * chat completions endpoint) so the model/vendor can be swapped via env vars only.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callLlmChat(messages: ChatMessage[]): Promise<string> {
  if (!env.openAiApiKey) {
    throw new AppError("AI provider is not configured (GROQ_API_KEY or OPENAI_API_KEY missing)", 503);
  }

  let lastFailure = "AI copilot request failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
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
          temperature: 0.3,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
    } catch (error) {
      lastFailure = "AI provider is unavailable";
      if (attempt === 2) {
        logger.error("llm_copilot_transport_failed", { error: error instanceof Error ? error.message : String(error) });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      lastFailure = `AI provider returned HTTP ${response.status}`;
      logger.warn("llm_copilot_request_attempt_failed", { attempt: attempt + 1, statusCode: response.status });
      if (response.status < 500 && response.status !== 429) break;
    } else {
      try {
        const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body?.choices?.[0]?.message?.content;
        if (!content) {
          lastFailure = "AI provider returned an empty response";
        } else {
          return content.trim();
        }
      } catch {
        lastFailure = "AI provider returned an unreadable response";
      }
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  logger.error("llm_copilot_failed", { reason: lastFailure });
  throw new AppError(lastFailure, 502);
}

/**
 * Multi-turn variant of callLlmJson — same retry/parse behavior, but takes a
 * full conversation history instead of a single system+user pair. Used by the
 * Copilot, which must return structured {answer, reasoning, confidence} JSON
 * while still carrying prior turns for context.
 */
export async function callLlmChatJson<T>(messages: ChatMessage[]): Promise<T> {
  if (!env.openAiApiKey) {
    throw new AppError("AI provider is not configured (GROQ_API_KEY or OPENAI_API_KEY missing)", 503, {
      decision: "ANALYSIS_UNAVAILABLE",
      reason: "No AI provider credential (Groq or OpenAI) is configured, so AcadIQ Copilot could not respond.",
      confidence: 0,
    });
  }

  let lastFailure = "AI copilot request failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
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
          max_tokens: 8192,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
    } catch (error) {
      lastFailure = "AI provider is unavailable";
      if (attempt === 2) {
        logger.error("llm_copilot_json_transport_failed", { error: error instanceof Error ? error.message : String(error) });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      lastFailure = `AI provider returned HTTP ${response.status}`;
      logger.warn("llm_copilot_json_attempt_failed", { attempt: attempt + 1, statusCode: response.status });
      if (response.status < 500 && response.status !== 429) break;
    } else {
      try {
        const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body?.choices?.[0]?.message?.content;
        if (!content) {
          lastFailure = "AI provider returned an empty response";
        } else {
          const normalized = content
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "");
          try {
            return JSON.parse(normalized) as T;
          } catch {
            const objectStart = normalized.indexOf("{");
            const objectEnd = normalized.lastIndexOf("}");
            if (objectStart >= 0 && objectEnd > objectStart) {
              try {
                return JSON.parse(normalized.slice(objectStart, objectEnd + 1)) as T;
              } catch {
                // fall through to retry
              }
            }
            lastFailure = "AI provider returned malformed JSON";
          }
        }
      } catch {
        lastFailure = "AI provider returned an unreadable response";
      }
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  logger.error("llm_copilot_json_failed", { reason: lastFailure });
  throw new AppError(lastFailure, 502, {
    decision: "ANALYSIS_UNAVAILABLE",
    reason: `${lastFailure} after 3 recovery attempts; AcadIQ Copilot did not respond.`,
    confidence: 0,
  });
}

export async function callLlmJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  if (!env.openAiApiKey) {
    throw new AppError("AI provider is not configured (GROQ_API_KEY or OPENAI_API_KEY missing)", 503, {
      decision: "ANALYSIS_UNAVAILABLE",
      reason: "No AI provider credential (Groq or OpenAI) is configured, so AcadIQ did not generate or store a decision.",
      confidence: 0,
    });
  }

  if (userPrompt.length > env.maxAiInputChars) {
    throw new AppError("Document content is too large for analysis", 413, { maxCharacters: env.maxAiInputChars });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastFailure = "AI analysis request failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
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
          max_tokens: 8192,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
    } catch (error) {
      lastFailure = "AI provider is unavailable";
      if (attempt === 2) {
        logger.error("llm_transport_failed", { error: error instanceof Error ? error.message : String(error) });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      continue;
    }
    if (!response.ok) {
      lastFailure = "AI analysis request failed";
      logger.warn("llm_request_attempt_failed", { attempt: attempt + 1, statusCode: response.status });
      if (response.status < 500 && response.status !== 429) break;
    } else {
      try {
        const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body?.choices?.[0]?.message?.content;
        if (!content) {
          lastFailure = "AI provider returned an empty response";
        } else {
          const normalized = content.trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "");
          try {
            return JSON.parse(normalized) as T;
          } catch {
            const objectStart = normalized.indexOf("{");
            const objectEnd = normalized.lastIndexOf("}");
            if (objectStart >= 0 && objectEnd > objectStart) {
              try {
                return JSON.parse(normalized.slice(objectStart, objectEnd + 1)) as T;
              } catch {
                // Fall through to the retry below.
              }
            }
            lastFailure = "AI provider returned malformed JSON";
          }
        }
      } catch {
        lastFailure = "AI provider returned an unreadable response";
      }
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  logger.error("llm_request_failed", { reason: lastFailure });
  throw new AppError(lastFailure, 502, {
    decision: "ANALYSIS_UNAVAILABLE",
    reason: `${lastFailure} after 3 recovery attempts; no AI decision was stored.`,
    confidence: 0,
  });
}
