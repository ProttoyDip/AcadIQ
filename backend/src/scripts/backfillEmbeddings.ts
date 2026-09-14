import { prisma } from "../database/prismaClient";
import { embeddingService } from "../ai/embedding/embeddingService";
import { embeddingRepository } from "../repositories/embedding.repository";

/**
 * Idempotent, resumable backfill of question embeddings.
 *   npm run embeddings:backfill -- [--course <id>] [--limit <n>] [--batch <n>]
 * Skips rows that already have a vector for the current model. Run via
 * `docker exec`, never from the entrypoint (slows boot, races migrations).
 */
function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const courseId = flag("course") ? Number(flag("course")) : undefined;
  const limit = flag("limit") ? Number(flag("limit")) : Number.POSITIVE_INFINITY;
  const pageSize = flag("batch") ? Number(flag("batch")) : 200;

  if (!embeddingService.available) throw new Error(embeddingService.unavailableReason ?? "embeddings unavailable");
  await embeddingService.warmUp();

  let cursor = 0;
  let scanned = 0;
  let indexed = 0;
  const started = Date.now();

  while (scanned < limit) {
    const rows = await prisma.question.findMany({
      where: { id: { gt: cursor }, paper: courseId ? { courseId } : undefined },
      orderBy: { id: "asc" },
      take: Math.min(pageSize, limit - scanned),
      select: { id: true, questionText: true, paper: { select: { courseId: true } } },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    const existing = await embeddingRepository.findExistingOwnerIds("QUESTION", rows.map((row) => row.id), embeddingService.model);
    const missing = rows.filter((row) => !existing.has(row.id));
    if (missing.length) {
      await embeddingService.ensureIndexed(
        "QUESTION",
        missing.map((row) => ({ id: row.id, text: row.questionText, courseId: row.paper.courseId }))
      );
      indexed += missing.length;
    }
    console.log(JSON.stringify({ scanned, indexed, cursor, elapsedMs: Date.now() - started }));
  }

  console.log(JSON.stringify({ done: true, scanned, indexed, model: embeddingService.model, elapsedMs: Date.now() - started }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await embeddingService.shutdown();
    await prisma.$disconnect();
  });
