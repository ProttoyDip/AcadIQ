import { z } from "zod";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { AgreementSummary } from "./aggregate";
import { cacheKeyOf, promptCache } from "./promptCache";
import { PromptDescriptor } from "./prompts/registry";
import { llmRateGate } from "./rateGate";
import { currentTraceScope, LlmRunTrace, recordRun } from "./trace";
import { callValidatedLlmJsonWithTrace, inputHashOf } from "./validatedLlm";

export type ReliabilityMode = "fast" | "verified";

export interface RunOptions<T> {
  /** `fast` = one near-deterministic call (today's behaviour). `verified` = k samples at higher temperature. */
  reliability?: ReliabilityMode;
  /** Explicit sample count; overrides the mode default. */
  k?: number;
  temperature?: number;
  model?: string;
  cache?: boolean;
  /** Required when k > 1: turns k validated samples into one consensus object. */
  aggregate?: (samples: T[]) => { consensus: T; agreement: AgreementSummary };
}

export interface RunResult<T> {
  consensus: T;
  samples: T[];
  /** null when k = 1 — a single run must never claim agreement. */
  agreement: AgreementSummary | null;
  trace: LlmRunTrace;
  cacheHits: number;
}

/**
 * The one entry point pipelines use for LLM analysis. Composes: content-hash
 * cache → sequential self-consistency sampler → schema validation → provenance
 * trace. Samples run sequentially on purpose: k parallel calls against a
 * TPM-limited provider is a guaranteed 429 storm.
 */
export async function runLlmAnalysis<A extends unknown[], T>(
  descriptor: PromptDescriptor<A>,
  args: A,
  schema: z.ZodType<T>,
  options: RunOptions<T> = {}
): Promise<RunResult<T>> {
  const k = Math.max(1, options.k ?? (options.reliability === "verified" ? env.reliability.sampleCount : 1));
  if (k > 1 && !options.aggregate) throw new Error(`${descriptor.id}: sampling with k=${k} requires an aggregate function`);
  const temperature = options.temperature ?? (k > 1 ? env.reliability.sampleTemperature : 0.2);
  const model = options.model ?? env.openAiModel;
  const useCache = (options.cache ?? true) && promptCache.enabled();
  const skipCacheRead = currentTraceScope()?.noCache ?? false;
  const userPrompt = descriptor.build(...args);
  const inputHash = inputHashOf(userPrompt);
  const identity = { id: descriptor.id, version: descriptor.version, hash: descriptor.hash };

  const samples: T[] = [];
  const sampleTraces: LlmRunTrace[] = [];
  let cacheHits = 0;

  for (let sampleIndex = 0; sampleIndex < k; sampleIndex += 1) {
    const key = cacheKeyOf({ promptHash: descriptor.hash, model, temperature, inputHash, sampleIndex });
    const cached = useCache && !skipCacheRead ? await promptCache.get(key) : null;

    const result = await llmRateGate.run(() =>
      callValidatedLlmJsonWithTrace(descriptor.system, userPrompt, schema, descriptor.id, {
        model,
        temperature,
        prompt: identity,
        sampleIndex,
        cached: cached ? { raw: cached.raw } : undefined,
      })
    );
    if (result.trace.cacheHit) cacheHits += 1;
    else if (useCache) await promptCache.set(key, descriptor.id, result.raw, result.meta?.totalTokens ?? null);
    samples.push(result.data);
    sampleTraces.push(result.trace);
  }

  if (k === 1) {
    return { consensus: samples[0], samples, agreement: null, trace: sampleTraces[0], cacheHits };
  }

  const { consensus, agreement } = options.aggregate!(samples);
  // Collapse the k per-sample traces (already recorded) into one run row carrying the agreement.
  const scope = currentTraceScope();
  if (scope) {
    for (const trace of sampleTraces) {
      const index = scope.runs.indexOf(trace);
      if (index >= 0) scope.runs.splice(index, 1);
    }
  }
  const sum = (pick: (t: LlmRunTrace) => number | null) =>
    sampleTraces.reduce<number | null>((total, t) => (pick(t) === null ? total : (total ?? 0) + pick(t)!), null);
  const merged: LlmRunTrace = {
    ...sampleTraces[0],
    sampleCount: k,
    cacheHit: cacheHits === k,
    promptTokens: sum((t) => t.promptTokens),
    completionTokens: sum((t) => t.completionTokens),
    totalTokens: sum((t) => t.totalTokens),
    latencyMs: sampleTraces.reduce((total, t) => total + t.latencyMs, 0),
    status: "OK",
    agreementJson: agreement,
    samples: sampleTraces.flatMap((t) => t.samples),
  };
  recordRun(merged);
  logger.info("llm_self_consistency", { pipeline: descriptor.id, k, agreement: agreement.agreement, cacheHits });
  return { consensus, samples, agreement, trace: merged, cacheHits };
}
