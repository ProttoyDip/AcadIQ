import { AsyncLocalStorage } from "node:async_hooks";

export type LlmRunStatus = "OK" | "VALIDATION_FAILED" | "PROVIDER_ERROR";

export interface LlmRunSample {
  sampleIndex: number;
  rawResponse: string;
  validated: boolean;
}

export interface LlmRunTrace {
  pipeline: string;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  model: string;
  temperature: number;
  inputHash: string;
  sampleCount: number;
  cacheHit: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  status: LlmRunStatus;
  agreementJson: unknown | null;
  samples: LlmRunSample[];
}

export interface TraceScope {
  requestId: string | null;
  /** Set from `?noCache=true`; the runner skips cache reads (still writes). */
  noCache: boolean;
  runs: LlmRunTrace[];
}

const storage = new AsyncLocalStorage<TraceScope>();

/** Request-level scope. Established by the request-context middleware. */
export function runInRequestScope<T>(requestId: string, noCache: boolean, fn: () => T): T {
  return storage.run({ requestId, noCache, runs: [] }, fn);
}

/**
 * Analysis-level scope. Each service call gets its own run list so concurrent
 * steps inside fullAnalysis never mix traces; requestId is inherited.
 */
export function withTraceScope<T>(fn: () => Promise<T>): Promise<T> {
  const parent = storage.getStore();
  return storage.run({ requestId: parent?.requestId ?? null, noCache: parent?.noCache ?? false, runs: [] }, fn);
}

export function currentTraceScope(): TraceScope | undefined {
  return storage.getStore();
}

export function recordRun(trace: LlmRunTrace) {
  storage.getStore()?.runs.push(trace);
}

/** Removes and returns the runs accumulated in the current scope. */
export function drainRuns(): LlmRunTrace[] {
  const scope = storage.getStore();
  if (!scope) return [];
  const runs = scope.runs.splice(0, scope.runs.length);
  return runs;
}
