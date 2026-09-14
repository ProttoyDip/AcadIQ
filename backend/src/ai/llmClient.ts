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

/**
 * Backoff between retries. A 429 means the provider is asking us to slow
 * down — a 250ms retry does nothing useful against a per-minute rate limit
 * and just burns the retry budget instantly. Honor Retry-After when the
 * provider sends one (capped so a bad value can't hang the request past the
 * caller's own timeout); otherwise back off several seconds, growing with
 * each attempt. Non-429 failures (transient 5xx, network blips) keep the
 * original fast retry — those really do often clear in milliseconds.
 */
function backoffDelayMs(attempt: number, response?: Response, hintMs?: number | null): number {
  if (hintMs && hintMs > 0) return Math.min(hintMs + 250, 20_000);
  if (response?.status === 429 || response?.status === 413) {
    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, 15_000);
    }
    return 2_000 * (attempt + 1);
  }
  return 250 * (attempt + 1);
}

interface ProviderFailure {
  message: string;
  /** True when waiting and retrying can succeed (429, or a 413 that is really a per-minute budget). */
  retryable: boolean;
  retryAfterMs: number | null;
  detail?: string;
}

/**
 * Groq reports both "request exceeds the model's per-request token limit" and
 * "you have exhausted this minute's token budget" as HTTP 413. Only the first
 * is fatal; the second should be waited out like a 429. The body tells them apart:
 *   "... on tokens per minute (TPM): Limit 8000, Requested 2900, please try again in 4.2s"
 */
export async function classifyFailure(response: Response): Promise<ProviderFailure> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } | string };
    detail = typeof body.error === "string" ? body.error : body.error?.message ?? "";
  } catch {
    detail = "";
  }
  const wait = detail.match(/try again in\s*([\d.]+)\s*(ms|s|m)\b/i);
  const retryAfterMs = wait ? Math.round(Number(wait[1]) * (wait[2] === "ms" ? 1 : wait[2] === "m" ? 60_000 : 1000)) : null;

  if (response.status === 429) {
    return { message: "AI provider rate limit reached (HTTP 429) — please retry in a minute", retryable: true, retryAfterMs, detail };
  }
  if (response.status === 413) {
    const limits = detail.match(/Limit\s*([\d,]+).*?Requested\s*([\d,]+)/i);
    const limit = limits ? Number(limits[1].replace(/,/g, "")) : null;
    const requested = limits ? Number(limits[2].replace(/,/g, "")) : null;
    const perMinute = /per minute|TPM|RPM/i.test(detail);
    if (perMinute && limit !== null && requested !== null && requested <= limit) {
      return {
        message: `AI provider token budget for this minute is used up (${requested.toLocaleString()} of ${limit.toLocaleString()} tokens/min) — please retry shortly`,
        retryable: true,
        retryAfterMs,
        detail,
      };
    }
    return {
      message: requested !== null && limit !== null
        ? `This request needs ~${requested.toLocaleString()} tokens but the AI provider allows ${limit.toLocaleString()} per request. Reduce the syllabus or question count and retry.`
        : "This request is too large for the AI provider's per-request limit. Reduce the syllabus or question count and retry.",
      retryable: false,
      retryAfterMs: null,
      detail,
    };
  }
  return { message: `AI provider returned HTTP ${response.status}`, retryable: response.status >= 500, retryAfterMs: null, detail };
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
      await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt)));
      continue;
    }

    if (!response.ok) {
      const failure = await classifyFailure(response);
      lastFailure = failure.message;
      logger.warn("llm_copilot_request_attempt_failed", { attempt: attempt + 1, statusCode: response.status, retryable: failure.retryable });
      if (!failure.retryable) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response, failure.retryAfterMs)));
      continue;
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

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response)));
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

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > env.maxAiInputChars) {
    throw new AppError("Conversation context is too large for the AI provider", 413, {
      maxCharacters: env.maxAiInputChars,
      actualCharacters: totalChars,
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
      await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt)));
      continue;
    }

    if (!response.ok) {
      const failure = await classifyFailure(response);
      lastFailure = failure.message;
      logger.warn("llm_copilot_json_attempt_failed", { attempt: attempt + 1, statusCode: response.status, retryable: failure.retryable });
      if (!failure.retryable) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response, failure.retryAfterMs)));
      continue;
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

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response)));
  }

  logger.error("llm_copilot_json_failed", { reason: lastFailure });
  throw new AppError(lastFailure, 502, {
    decision: "ANALYSIS_UNAVAILABLE",
    reason: `${lastFailure} after 3 recovery attempts; AcadIQ Copilot did not respond.`,
    confidence: 0,
  });
}

export interface LlmCallOptions {
  model?: string;
  /** Defaults to 0.2 (near-deterministic). Self-consistency sampling raises it. */
  temperature?: number;
}

export interface LlmCallMeta {
  model: string;
  temperature: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  attempts: number;
  /** Groq/OpenAI `x-ratelimit-remaining-tokens`, when the provider sends it. */
  rateLimitRemainingTokens: number | null;
  rateLimitRemainingRequests: number | null;
}

export interface LlmJsonResult<T> {
  data: T;
  /** Exact provider text, kept for provenance and cache; never re-serialised. */
  raw: string;
  meta: LlmCallMeta;
}

interface ChatCompletionBody {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function headerNumber(response: Response, name: string): number | null {
  const value = Number(response.headers.get(name));
  return Number.isFinite(value) && response.headers.has(name) ? value : null;
}

function parseJsonObject<T>(content: string): T | undefined {
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
        return undefined;
      }
    }
    return undefined;
  }
}

export async function callLlmJsonWithMeta<T>(
  systemPrompt: string,
  userPrompt: string,
  options: LlmCallOptions = {}
): Promise<LlmJsonResult<T>> {
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
  const model = options.model ?? env.openAiModel;
  const temperature = options.temperature ?? 0.2;
  const started = Date.now();

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
          model,
          messages,
          temperature,
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
      await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt)));
      continue;
    }
    if (!response.ok) {
      const remaining = headerNumber(response, "x-ratelimit-remaining-tokens");
      const failure = await classifyFailure(response);
      lastFailure = failure.message;
      logger.warn("llm_request_attempt_failed", {
        attempt: attempt + 1,
        statusCode: response.status,
        model,
        remainingTokens: remaining,
        promptChars: systemPrompt.length + userPrompt.length,
        retryable: failure.retryable,
        detail: failure.detail?.slice(0, 200),
      });
      if (!failure.retryable) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response, failure.retryAfterMs)));
      continue;
    } else {
      try {
        const body = (await response.json()) as ChatCompletionBody;
        const content = body?.choices?.[0]?.message?.content;
        if (!content) {
          lastFailure = "AI provider returned an empty response";
        } else {
          const data = parseJsonObject<T>(content);
          if (data !== undefined) {
            return {
              data,
              raw: content,
              meta: {
                model,
                temperature,
                promptTokens: body.usage?.prompt_tokens ?? null,
                completionTokens: body.usage?.completion_tokens ?? null,
                totalTokens: body.usage?.total_tokens ?? null,
                latencyMs: Date.now() - started,
                attempts: attempt + 1,
                rateLimitRemainingTokens: headerNumber(response, "x-ratelimit-remaining-tokens"),
                rateLimitRemainingRequests: headerNumber(response, "x-ratelimit-remaining-requests"),
              },
            };
          }
          lastFailure = "AI provider returned malformed JSON";
        }
      } catch {
        lastFailure = "AI provider returned an unreadable response";
      }
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response)));
  }

  logger.error("llm_request_failed", { reason: lastFailure });
  throw new AppError(lastFailure, 502, {
    decision: "ANALYSIS_UNAVAILABLE",
    reason: `${lastFailure} after 3 recovery attempts; no AI decision was stored.`,
    confidence: 0,
  });
}

export async function callLlmJson<T>(systemPrompt: string, userPrompt: string, options: LlmCallOptions = {}): Promise<T> {
  return (await callLlmJsonWithMeta<T>(systemPrompt, userPrompt, options)).data;
}
