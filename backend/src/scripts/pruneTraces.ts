import { prisma } from "../database/prismaClient";
import { env } from "../config/env";
import { provenanceRepository } from "../repositories/provenance.repository";
import { promptCache } from "../ai/promptCache";

/**
 * Retention: raw LONGTEXT samples grow fast. Deletes samples older than
 * TRACE_RETENTION_DAYS (run rows and their token/latency metadata are kept),
 * and expired LLM cache entries.
 *   npm run traces:prune -- [--days <n>]
 */
function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const days = flag("days") ? Number(flag("days")) : env.reliability.traceRetentionDays;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const samples = await provenanceRepository.pruneSamplesOlderThan(cutoff);
  const cache = await promptCache.pruneExpired();
  console.log(JSON.stringify({ prunedSamples: samples.count, prunedCacheEntries: cache.count, cutoff: cutoff.toISOString() }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
