import { createHash } from "node:crypto";
import { prisma } from "../database/prismaClient";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface CacheKeyParts {
  promptHash: string;
  model: string;
  temperature: number;
  inputHash: string;
  /** Must be part of the key: otherwise a k=3 sampler reads one response three times and reports 100% agreement. */
  sampleIndex: number;
}

export function cacheKeyOf(parts: CacheKeyParts): string {
  return createHash("sha256")
    .update([parts.promptHash, parts.model, parts.temperature.toFixed(2), parts.inputHash, String(parts.sampleIndex)].join("|"))
    .digest("hex");
}

export const promptCache = {
  enabled(): boolean {
    return env.reliability.cacheEnabled;
  },

  /** Returns the raw response string, or null. Bumps hit counters. */
  async get(key: string): Promise<{ raw: string; totalTokens: number } | null> {
    if (!env.reliability.cacheEnabled) return null;
    try {
      const entry = await prisma.llmCacheEntry.findUnique({ where: { cacheKey: key } });
      if (!entry || entry.expiresAt.getTime() < Date.now()) return null;
      await prisma.llmCacheEntry.update({
        where: { id: entry.id },
        data: { hitCount: { increment: 1 }, tokensSaved: { increment: entry.totalTokens } },
      });
      return { raw: entry.rawResponse, totalTokens: entry.totalTokens };
    } catch (error) {
      logger.warn("llm_cache_read_failed", { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /** Only schema-valid successes are stored; callers guarantee `raw` already validated. */
  async set(key: string, pipeline: string, raw: string, totalTokens: number | null): Promise<void> {
    if (!env.reliability.cacheEnabled) return;
    const expiresAt = new Date(Date.now() + env.reliability.cacheTtlDays * 86_400_000);
    try {
      await prisma.llmCacheEntry.upsert({
        where: { cacheKey: key },
        create: { cacheKey: key, pipeline, rawResponse: raw, totalTokens: totalTokens ?? 0, expiresAt },
        update: { rawResponse: raw, totalTokens: totalTokens ?? 0, expiresAt },
      });
    } catch (error) {
      logger.warn("llm_cache_write_failed", { reason: error instanceof Error ? error.message : String(error) });
    }
  },

  pruneExpired() {
    return prisma.llmCacheEntry.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },

  async stats() {
    const agg = await prisma.llmCacheEntry.aggregate({ _count: true, _sum: { hitCount: true, tokensSaved: true } });
    return { entries: agg._count, hits: agg._sum.hitCount ?? 0, tokensSaved: agg._sum.tokensSaved ?? 0 };
  },
};
