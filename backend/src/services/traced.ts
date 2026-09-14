import { prisma } from "../database/prismaClient";
import { currentTraceScope, drainRuns, withTraceScope } from "../ai/trace";
import { provenanceRepository } from "../repositories/provenance.repository";
import { logger } from "../utils/logger";

/**
 * Wraps one analysis so its LLM runs are isolated from concurrent steps. Runs
 * that were not attached to a report (provider errors, validation failures,
 * a thrown post-processing check) are persisted fire-and-forget with a NULL
 * reportId — this is what makes 429 storms visible for the first time.
 */
export function tracedAnalysis<T>(fn: () => Promise<T>): Promise<T> {
  return withTraceScope(async () => {
    try {
      return await fn();
    } finally {
      const orphans = drainRuns();
      if (orphans.length) {
        const requestId = currentTraceScope()?.requestId ?? null;
        provenanceRepository.createRuns(prisma, orphans, null, requestId).catch((error) => {
          logger.warn("provenance_orphan_write_failed", { reason: error instanceof Error ? error.message : String(error) });
        });
      }
    }
  });
}
