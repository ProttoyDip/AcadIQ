import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";
import { getAiProviders } from "./providers";
import { publicAiModel, resolveChatSelection } from "./modelRouting";
import { recordAiModel } from "./modelContext";
import { classifyFailure } from "./providerErrors";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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

export interface LlmCallOptions {
  model?: string;
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
            ...(options.json && provider.jsonMode !== false ? { response_format: { type: "json_object" } } : {}) }),
          signal: AbortSignal.timeout(Math.max(1, Math.min(deadline - Date.now(), Math.max(1000, Math.floor(env.aiTimeoutMs / candidates.length))))),
        });
        if (!response.ok) {
          const failure = await classifyFailure(response);
          lastFailure = failure.message;
          const quota = response.status === 402 || /insufficient_quota|insufficient (?:credits|balance)|quota.*exhausted|credit.*(?:exhausted|insufficient)/i.test((failure.code ?? "") + " " + (failure.detail ?? ""));
          const canSwitch = failure.retryable || quota || response.status === 401 || response.status === 408;
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

export async function callLlmChat(messages: ChatMessage[], options: LlmCallOptions = {}): Promise<string> {
  return (await routedCompletion(messages, { ...options, maxTokens: 2048 })).raw.trim();
}

export async function callLlmChatJson<T>(messages: ChatMessage[], options: LlmCallOptions = {}): Promise<T> {
  return (await routedCompletion<T>(messages, { ...options, json: true })).data!;
}

export async function callLlmJsonWithMeta<T>(systemPrompt: string, userPrompt: string, options: LlmCallOptions = {}): Promise<LlmJsonResult<T>> {
  const result = await routedCompletion<T>([
    { role: "system", content: systemPrompt }, { role: "user", content: userPrompt },
  ], { ...options, json: true });
  return { data: result.data!, raw: result.raw, meta: result.meta };
}

export async function callLlmJson<T>(systemPrompt: string, userPrompt: string, options: LlmCallOptions = {}): Promise<T> {
  return (await callLlmJsonWithMeta<T>(systemPrompt, userPrompt, options)).data;
}
