import { prisma } from "../database/prismaClient";
import { embeddingService } from "../ai/embedding/embeddingService";
import { dot } from "../ai/embedding/vectorMath";
import { env } from "../config/env";

/**
 * Prints the intra-course pairwise cosine distribution so the similarity floor
 * can be set from data instead of guesswork.
 *   npm run embeddings:calibrate -- [--course <id>]
 * Only questions that already have a stored vector are considered; run the
 * backfill first.
 */
function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

async function main() {
  const onlyCourse = flag("course") ? Number(flag("course")) : undefined;
  const courses = await prisma.course.findMany({
    where: onlyCourse ? { id: onlyCourse } : undefined,
    select: { id: true, courseCode: true },
    orderBy: { id: "asc" },
  });

  console.log(`configured floor=${env.embedding.similarityFloor} nearDuplicate=${env.embedding.nearDuplicate}`);
  console.log("course        n     pairs   p50    p90    p95    p99    max   >=floor  >=nearDup");

  for (const course of courses) {
    const vectors = await embeddingService.findCourseVectors(course.id);
    if (vectors.length < 2) continue;
    const sample = vectors.length > 400 ? vectors.filter((_, index) => index % Math.ceil(vectors.length / 400) === 0) : vectors;
    const values: number[] = [];
    for (let i = 0; i < sample.length; i += 1) {
      for (let j = i + 1; j < sample.length; j += 1) {
        values.push(dot(sample[i].vector, sample[j].vector));
      }
    }
    values.sort((a, b) => a - b);
    const aboveFloor = values.filter((value) => value >= env.embedding.similarityFloor).length;
    const nearDup = values.filter((value) => value >= env.embedding.nearDuplicate).length;
    console.log(
      [
        course.courseCode.padEnd(12),
        String(vectors.length).padStart(5),
        String(values.length).padStart(8),
        percentile(values, 0.5).toFixed(3).padStart(7),
        percentile(values, 0.9).toFixed(3).padStart(7),
        percentile(values, 0.95).toFixed(3).padStart(7),
        percentile(values, 0.99).toFixed(3).padStart(7),
        values[values.length - 1].toFixed(3).padStart(7),
        String(aboveFloor).padStart(8),
        String(nearDup).padStart(10),
      ].join(" ")
    );
  }
  console.log("\nAdaptive floor used at query time = max(configured floor, p95 of the previous-paper background).");
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
