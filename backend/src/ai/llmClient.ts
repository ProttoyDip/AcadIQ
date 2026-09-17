import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";
import { getAiProviders } from "./providers";
import { publicAiModel, resolveChatSelection } from "./modelRouting";
import { recordAiModel } from "./modelContext";

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
    const body = (await response.json()) as { error?: { message?: string; code?: string | number } | string };
    // The machine-readable `code` is kept alongside the prose: providers signal an
    // exhausted account as code "insufficient_quota" with a message that need not
    // contain any quota wording, and routing has to see both to fail over.
    detail = typeof body.error === "string" ? body.error : [body.error?.message, body.error?.code].filter(Boolean).join(" ");
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

export async function callLlmChat(messages: ChatMessage[], options: LlmCallOptions = {}): Promise<string> {
  return (await routedCompletion(messages, { ...options, maxTokens: 2048 })).raw.trim();
}

/**
 * One image + instruction → text, via the OpenAI-compatible `image_url` content part.
 * Used to transcribe photographed timetables before the normal text pipeline runs.
 */
export async function callLlmVision(image: { mimeType: string; base64: string }, instruction: string, options: { maxTokens?: number } = {}): Promise<string> {
  if (!env.openAiApiKey) throw new AppError("AI provider is not configured (GROQ_API_KEY or OPENAI_API_KEY missing)", 503);
  if (!env.visionModel) throw new AppError("Image import is disabled on this server (VISION_MODEL is empty)", 400);
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text", text: instruction },
        { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ],
    },
  ];
  return chatCompletion(env.visionModel, messages as unknown as ChatMessage[], "llm_vision", { temperature: 0.1, maxTokens: options.maxTokens ?? 4096 });
}

/**
 * Audio → text via the OpenAI-compatible /audio/transcriptions endpoint (Groq
 * serves Whisper there). Deliberately NOT the browser's Web Speech API: faculty
 * here dictate in Bengali and Bangla-accented English, which the browser engines
 * transcribe badly, and Web Speech is Chrome-only.
 *
 * Retries transport failures and rate limits the same way chatCompletion does,
 * but never retries a rejected file — a clip the provider refuses once will be
 * refused again, and each attempt re-uploads the whole payload.
 */
export async function callLlmTranscription(
  audio: { buffer: Buffer; filename: string; mimeType: string },
  options: { language?: string } = {}
): Promise<string> {
  if (!env.openAiApiKey) throw new AppError("AI provider is not configured (GROQ_API_KEY or OPENAI_API_KEY missing)", 503);
  if (!env.speechModel) throw new AppError("Voice input is disabled on this server (SPEECH_MODEL is empty)", 400);

  let lastFailure = "Voice transcription failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType }), audio.filename);
    form.append("model", env.speechModel);
    form.append("response_format", "json");
    // Left unset by default: forcing a language makes Whisper mistranscribe the
    // other one, and faculty here mix Bengali and English in a single sentence.
    if (options.language) form.append("language", options.language);

    let response: Response;
    try {
      response = await fetch(env.speechBaseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.openAiApiKey}` },
        body: form,
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
    } catch (error) {
      lastFailure = "AI provider is unavailable";
      if (attempt === 2) {
        logger.error("llm_transcription_transport_failed", { error: error instanceof Error ? error.message : String(error) });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt)));
      continue;
    }

    if (response.ok) {
      try {
        const body = (await response.json()) as { text?: string };
        const text = (body.text ?? "").trim();
        if (text) return text;
        lastFailure = "No speech was detected in the recording";
        break; // A silent clip is a user problem; retrying re-bills the same silence.
      } catch {
        lastFailure = "AI provider returned an unreadable transcription";
        break;
      }
    }

    const failure = await classifyFailure(response);
    lastFailure = failure.message;
    logger.warn("llm_transcription_attempt_failed", { attempt: attempt + 1, statusCode: response.status, retryable: failure.retryable });
    if (!failure.retryable) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt, response, failure.retryAfterMs)));
  }

  logger.error("llm_transcription_failed", { reason: lastFailure });
  throw new AppError(lastFailure, 502);
}

async function chatCompletion(model: string, messages: ChatMessage[], logPrefix: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<string> {

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
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: AbortSignal.timeout(env.aiTimeoutMs),
      });
    } catch (error) {
      lastFailure = "AI provider is unavailable";
      if (attempt === 2) {
        logger.error(`${logPrefix}_transport_failed`, { error: error instanceof Error ? error.message : String(error) });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt)));
      continue;
    }

    if (!response.ok) {
      const failure = await classifyFailure(response);
      lastFailure = failure.message;
      logger.warn(`${logPrefix}_request_attempt_failed`, { attempt: attempt + 1, statusCode: response.status, retryable: failure.retryable, model });
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

  logger.error(`${logPrefix}_failed`, { reason: lastFailure, model });
  throw new AppError(lastFailure, 502);
}

/**
 * Multi-turn variant of callLlmJson — same retry/parse behavior, but takes a
 * full conversation history instead of a single system+user pair. Used by the
 * Copilot, which must return structured {answer, reasoning, confidence} JSON
 * while still carrying prior turns for context.
 */
export async function callLlmChatJson<T>(messages: ChatMessage[], options: LlmCallOptions = {}): Promise<T> {
  return (await routedCompletion<T>(messages, { ...options, json: true })).data!;
}

export interface LlmCallOptions {
  model?: string;
  /** Explicit model calls are strict unless fallback is enabled. */
  allowFallback?: boolean;
  /** Defaults to 0.2 (near-deterministic). Self-consistency sampling raises it. */
  temperature?: number;
}

export interface LlmCallMeta {
  model: string;
  modelId: string;
  provider: string;
  fallbackUsed: boolean;
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
  model?: string;
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

// Cooldowns are local to this server process. They reduce repeated calls to an
// exhausted account; they are not a balance estimate or a permanent disable.
const providerCooldowns = new Map<string, number>();
export function resetAiProviderCooldowns() { providerCooldowns.clear(); }

async function routedCompletion<T = unknown>(
  messages: ChatMessage[],
  options: LlmCallOptions & { json?: boolean; maxTokens?: number }
): Promise<{ raw: string; data?: T; meta: LlmCallMeta }> {
  if (messages.reduce((sum, message) => sum + message.content.length, 0) > env.maxAiInputChars) {
    throw new AppError("Conversation context is too large for the AI provider", 413, { maxCharacters: env.maxAiInputChars });
  }
  const { target, allowFallback } = resolveChatSelection(options);
  const candidates = [target];
  if (allowFallback) {
    for (const provider of getAiProviders()) {
      if (provider.id !== target.provider.id) candidates.push({ provider, model: provider.defaultModel, id: `${provider.id}:${provider.defaultModel}` });
    }
  }
  const started = Date.now();
  const deadline = started + env.aiTimeoutMs;
  const temperature = options.temperature ?? 0.2;
  let attempts = 0;
  let lastFailure = "Configured AI providers are temporarily unavailable. Please retry shortly.";

  for (const candidate of candidates) {
    const { provider, model } = candidate;
    const cooldownKey = `${provider.id}:${provider.baseUrl}`;
    // Explicit, strict choices still get a fresh attempt if the user retries.
    if (allowFallback && (providerCooldowns.get(cooldownKey) ?? 0) > Date.now()) continue;
    for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt += 1) {
      attempts += 1;
      let response: Response;
      let body: ChatCompletionBody;
      try {
        response = await fetch(provider.baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
          body: JSON.stringify({ model, messages, temperature, max_tokens: options.maxTokens ?? 8192,
            ...(options.json ? { response_format: { type: "json_object" } } : {}) }),
          signal: AbortSignal.timeout(Math.max(1, Math.min(deadline - Date.now(), Math.max(1000, Math.floor(env.aiTimeoutMs / candidates.length))))),
        });
        if (!response.ok) {
          const failure = await classifyFailure(response);
          lastFailure = failure.message;
          const quota = response.status === 402 || /insufficient_quota|insufficient (?:credits|balance)|quota.*exhausted|credit.*(?:exhausted|insufficient)/i.test(failure.detail ?? "");
          const canSwitch = failure.retryable || quota || response.status === 401 || response.status === 403 || response.status === 408;
          logger.warn("llm_provider_attempt_failed", { provider: provider.id, model, statusCode: response.status, attempt: attempts });
          if (!canSwitch) throw new AppError(lastFailure, response.status === 413 ? 413 : 502);
          if (allowFallback) {
            const headerSeconds = Number(response.headers.get("retry-after"));
            const headerDate = Date.parse(response.headers.get("retry-after") ?? "");
            const wait = failure.retryAfterMs ?? (headerSeconds > 0 ? headerSeconds * 1000 : Number.isFinite(headerDate) ? headerDate - Date.now() : 0);
            providerCooldowns.set(cooldownKey, Date.now() + Math.min(300_000, Math.max(wait, quota ? 60_000 : response.status === 429 ? 30_000 : 5_000)));
            break;
          }
          if (quota || !failure.retryable) break;
          const delay = backoffDelayMs(attempt, response, failure.retryAfterMs);
          if (attempt < 2 && Date.now() + delay < deadline) await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        body = await response.json() as ChatCompletionBody;
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastFailure = "AI provider is unavailable or returned an unreadable response";
        // A failed transport can be served by another configured account.
        if (allowFallback) {
          providerCooldowns.set(cooldownKey, Date.now() + 5_000);
          break;
        }
        if (attempt < 2 && Date.now() + 250 < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      const content = body?.choices?.[0]?.message?.content;
      const data = typeof content === "string" && options.json ? parseJsonObject<T>(content) : undefined;
      if (typeof content === "string" && content.trim() && (!options.json || data !== undefined)) {
        // Routers can resolve an alias to a concrete model; use their returned ID
        // when available so attribution never labels a fallback as the request.
        const actualModel = typeof body.model === "string" && body.model.trim() ? body.model.trim() : model;
        const actual = { ...candidate, model: actualModel, id: `${provider.id}:${actualModel}` };
        const fallbackUsed = candidate.id !== target.id;
        providerCooldowns.delete(cooldownKey);
        recordAiModel(publicAiModel(actual), fallbackUsed);
        return { raw: content, data, meta: {
          model: actualModel, modelId: actual.id, provider: provider.id, fallbackUsed, temperature,
          promptTokens: body.usage?.prompt_tokens ?? null, completionTokens: body.usage?.completion_tokens ?? null,
          totalTokens: body.usage?.total_tokens ?? null, latencyMs: Date.now() - started, attempts,
          rateLimitRemainingTokens: headerNumber(response, "x-ratelimit-remaining-tokens"),
          rateLimitRemainingRequests: headerNumber(response, "x-ratelimit-remaining-requests"),
        } };
      }
      lastFailure = options.json ? "AI provider returned malformed JSON" : "AI provider returned an empty response";
      if (attempt < 2 && Date.now() + 250 < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new AppError(lastFailure, 502, { decision: "ANALYSIS_UNAVAILABLE", reason: "No configured AI model completed this request.", confidence: 0 });
}

export async function callLlmJsonWithMeta<T>(
  systemPrompt: string,
  userPrompt: string,
  options: LlmCallOptions = {}
): Promise<LlmJsonResult<T>> {
  const result = await routedCompletion<T>([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { ...options, json: true });
  return { data: result.data!, raw: result.raw, meta: result.meta };
}

export async function callLlmJson<T>(systemPrompt: string, userPrompt: string, options: LlmCallOptions = {}): Promise<T> {
  return (await callLlmJsonWithMeta<T>(systemPrompt, userPrompt, options)).data;
}
