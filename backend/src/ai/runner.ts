import { z } from "zod";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { AgreementSummary } from "./aggregate";
import { cacheKeyOf, promptCache } from "./promptCache";
import { PromptDescriptor } from "./prompts/registry";
import { llmRateGate } from "./rateGate";
import { currentTraceScope, LlmRunTrace, recordRun } from "./trace";
import { callValidatedLlmJsonWithTrace, inputHashOf } from "./validatedLlm";
import { resolveChatSelection } from "./modelRouting";

export type ReliabilityMode = "fast" | "verified" | "cross-model";

export interface RunOptions<T> {
  /**
   * `fast` = one near-deterministic call (today's behaviour).
   * `verified` = k samples of the same model at higher temperature (self-consistency).
   * `cross-model` = one low-temperature call per configured model (primary + dual-eval secondary);
   *   two different vendors disagreeing is a stronger signal than one model repeating itself.
   */
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
  const crossModel = options.reliability === "cross-model";
  // `undefined` means "whatever model this request selected". Substituting
  // env.openAiModel here would hand llmClient an *explicit* model, which pins the
  // call to the legacy provider and switches fallback off, silently making the
  // user's X-AI-Model choice ineffective on every pipeline. Cross-model runs still
  // name both vendors outright, because that mode is about a fixed pair.
  // Cross-model names its pair outright; every other run leaves the slot unset.
  const crossModelModels: string[] = [...new Set([options.model ?? env.openAiModel, env.dualEvalSecondaryModel])];
  const models: (string | undefined)[] = crossModel ? crossModelModels : [options.model];
  const k = Math.max(1, options.k ?? (crossModel ? models.length : options.reliability === "verified" ? env.reliability.sampleCount : 1));
  if (k > 1 && !options.aggregate) throw new Error(`${descriptor.id}: sampling with k=${k} requires an aggregate function`);
  // Cross-model runs stay near-deterministic so disagreement is attributable to the model, not the temperature.
  const temperature = options.temperature ?? (k > 1 && !crossModel ? env.reliability.sampleTemperature : 0.2);
  const useCache = (options.cache ?? true) && promptCache.enabled();
  const skipCacheRead = currentTraceScope()?.noCache ?? false;
  const userPrompt = descriptor.build(...args);
  const inputHash = inputHashOf(userPrompt);
  const identity = { id: descriptor.id, version: descriptor.version, hash: descriptor.hash };

  const samples: T[] = [];
  const sampleTraces: LlmRunTrace[] = [];
  let cacheHits = 0;

  for (let sampleIndex = 0; sampleIndex < k; sampleIndex += 1) {
    const requestedModel = models[sampleIndex % models.length];
    // A cache key has to name one concrete model, so resolve the ambient selection
    // for identity only. The call below still passes `undefined`, leaving llmClient
    // free to fail over to another provider when this one is exhausted.
    const model = requestedModel ?? resolveChatSelection().target.id;
    const key = cacheKeyOf({ promptHash: descriptor.hash, model, temperature, inputHash, sampleIndex });
    const cached = useCache && !skipCacheRead ? await promptCache.get(key) : null;

    const result = await llmRateGate.run(() =>
      callValidatedLlmJsonWithTrace(descriptor.system, userPrompt, schema, descriptor.id, {
        model: requestedModel,
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

  const { consensus, agreement: baseAgreement } = options.aggregate!(samples);
  const agreement: AgreementSummary = {
    ...baseAgreement,
    mode: crossModel ? "cross-model" : "self-consistency",
    models: crossModel ? crossModelModels : undefined,
  };
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
    model: crossModel ? crossModelModels.join("+") : sampleTraces[0].model,
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
  logger.info("llm_self_consistency", { pipeline: descriptor.id, k, mode: agreement.mode, agreement: agreement.agreement, cacheHits });
  return { consensus, samples, agreement, trace: merged, cacheHits };
}
