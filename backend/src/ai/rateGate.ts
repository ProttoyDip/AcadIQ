import { env } from "../config/env";

/**
 * Process-wide semaphore for LLM calls. fullAnalysis's per-request CONCURRENCY
 * did nothing for two concurrent users; this bounds in-flight provider requests
 * across the whole process, and the self-consistency sampler shares it.
 */
class RateGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  get inFlight(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

export const llmRateGate = new RateGate(env.reliability.maxConcurrentLlmCalls);
