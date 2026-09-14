import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../middleware/error.middleware";
import { logger } from "../utils/logger";
import { callLlmJsonWithMeta, LlmCallMeta, LlmCallOptions } from "./llmClient";
import { LlmRunSample, LlmRunTrace, recordRun } from "./trace";

const MAX_VALIDATION_ATTEMPTS = 2;

export interface PromptIdentity {
  id: string;
  version: string;
  hash: string;
}

export interface ValidatedCallOptions extends LlmCallOptions {
  /** Provenance identity; defaults to an "unversioned" descriptor hashed from the system prompt. */
  prompt?: PromptIdentity;
  /** Raw response served from cache; validated again here and no provider call is made if it still passes. */
  cached?: { raw: string };
  /** Position inside a self-consistency sample set; recorded on the trace. */
  sampleIndex?: number;
}

export interface ValidatedCallResult<T> {
  data: T;
  raw: string;
  meta: LlmCallMeta | null;
  trace: LlmRunTrace;
}

function validationSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
    .join("; ");
}

export function inputHashOf(userPrompt: string): string {
  return createHash("sha256").update(userPrompt).digest("hex");
}

function fallbackPromptIdentity(systemPrompt: string): PromptIdentity {
  return { id: "unversioned", version: "v0", hash: createHash("sha256").update(systemPrompt).digest("hex") };
}

/**
 * Validates before any AI output can reach persistence. A schema failure gets
 * one constrained repair attempt; repeated failure is rejected, never stored.
 * Every attempt (including failures) is recorded on the ambient trace scope so
 * provenance is visible even when no report is produced.
 */
export async function callValidatedLlmJsonWithTrace<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  pipeline: string,
  options: ValidatedCallOptions = {}
): Promise<ValidatedCallResult<T>> {
  const prompt = options.prompt ?? fallbackPromptIdentity(systemPrompt);
  const inputHash = inputHashOf(userPrompt);
  const started = Date.now();
  const samples: LlmRunSample[] = [];
  const sampleIndex = options.sampleIndex ?? 0;
  let meta: LlmCallMeta | null = null;

  const finish = (status: LlmRunTrace["status"], cacheHit: boolean): LlmRunTrace => {
    const trace: LlmRunTrace = {
      pipeline,
      promptId: prompt.id,
      promptVersion: prompt.version,
      promptHash: prompt.hash,
      model: options.model ?? meta?.model ?? "",
      temperature: options.temperature ?? 0.2,
      inputHash,
      sampleCount: 1,
      cacheHit,
      promptTokens: meta?.promptTokens ?? null,
      completionTokens: meta?.completionTokens ?? null,
      totalTokens: meta?.totalTokens ?? null,
      latencyMs: Date.now() - started,
      status,
      agreementJson: null,
      samples,
    };
    recordRun(trace);
    return trace;
  };

  if (options.cached) {
    let cachedValue: unknown;
    try {
      cachedValue = JSON.parse(options.cached.raw);
    } catch {
      cachedValue = undefined;
    }
    const parsed = schema.safeParse(cachedValue);
    if (parsed.success) {
      samples.push({ sampleIndex, rawResponse: options.cached.raw, validated: true });
      return { data: parsed.data, raw: options.cached.raw, meta: null, trace: finish("OK", true) };
    }
    // A cached response that no longer satisfies a tightened schema is ignored, not served.
    logger.info("llm_cache_entry_stale", { pipeline });
  }

  let recoveryPrompt = userPrompt;
  try {
    for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt += 1) {
      const result = await callLlmJsonWithMeta<unknown>(systemPrompt, recoveryPrompt, {
        model: options.model,
        temperature: options.temperature,
      });
      meta = result.meta;
      const parsed = schema.safeParse(result.data);
      samples.push({ sampleIndex, rawResponse: result.raw, validated: parsed.success });
      if (parsed.success) {
        return { data: parsed.data, raw: result.raw, meta: result.meta, trace: finish("OK", false) };
      }

      logger.warn("llm_response_validation_failed", { pipeline, attempt, issues: validationSummary(parsed.error) });
      recoveryPrompt = `${userPrompt}\n\nRECOVERY INSTRUCTION: Your previous JSON failed validation: ${validationSummary(parsed.error)}. Return a complete corrected JSON object matching the system schema. Do not add prose or markdown.`;
    }
  } catch (error) {
    finish("PROVIDER_ERROR", false);
    throw error;
  }

  finish("VALIDATION_FAILED", false);
  throw new AppError("AI response failed validation after recovery", 502, {
    decision: "ANALYSIS_UNAVAILABLE",
    reason: `The ${pipeline} response remained invalid after ${MAX_VALIDATION_ATTEMPTS} validation attempts and was not stored.`,
    confidence: 0,
  });
}

export async function callValidatedLlmJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  pipeline: string,
  options: ValidatedCallOptions = {}
): Promise<T> {
  return (await callValidatedLlmJsonWithTrace(systemPrompt, userPrompt, schema, pipeline, options)).data;
}
