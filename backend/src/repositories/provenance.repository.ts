import { Prisma } from "@prisma/client";
import { prisma } from "../database/prismaClient";
import { LlmRunTrace } from "../ai/trace";

type Client = Prisma.TransactionClient | typeof prisma;

function runCreateData(trace: LlmRunTrace, reportId: number | null, requestId: string | null) {
  return {
    reportId,
    pipeline: trace.pipeline,
    promptId: trace.promptId,
    promptVersion: trace.promptVersion,
    promptHash: trace.promptHash,
    model: trace.model,
    temperature: new Prisma.Decimal(trace.temperature.toFixed(2)),
    inputHash: trace.inputHash,
    sampleCount: trace.sampleCount,
    cacheHit: trace.cacheHit,
    promptTokens: trace.promptTokens,
    completionTokens: trace.completionTokens,
    totalTokens: trace.totalTokens,
    latencyMs: trace.latencyMs,
    status: trace.status,
    agreementJson: trace.agreementJson === null ? Prisma.JsonNull : (trace.agreementJson as Prisma.InputJsonValue),
    requestId,
    samples: trace.samples.length
      ? { create: trace.samples.map((s) => ({ sampleIndex: s.sampleIndex, rawResponse: s.rawResponse, validated: s.validated })) }
      : undefined,
  };
}

export const provenanceRepository = {
  async createRuns(client: Client, traces: LlmRunTrace[], reportId: number | null, requestId: string | null) {
    for (const trace of traces) {
      await client.analysisRun.create({ data: runCreateData(trace, reportId, requestId) });
    }
  },

  findByReport(reportId: number) {
    return prisma.analysisRun.findMany({
      where: { reportId },
      orderBy: { id: "asc" },
      include: { samples: { select: { id: true, sampleIndex: true, validated: true, createdAt: true }, orderBy: { sampleIndex: "asc" } } },
    });
  },

  findSample(runId: number, sampleIndex: number) {
    return prisma.analysisRunSample.findFirst({ where: { runId, sampleIndex } });
  },

  async usageSummary(facultyId?: number) {
    const where: Prisma.AnalysisRunWhereInput = facultyId ? { report: { facultyId } } : {};
    const [agg, cacheHits, byStatus] = await Promise.all([
      prisma.analysisRun.aggregate({ where, _sum: { promptTokens: true, completionTokens: true, totalTokens: true }, _count: true, _avg: { latencyMs: true } }),
      prisma.analysisRun.count({ where: { ...where, cacheHit: true } }),
      prisma.analysisRun.groupBy({ by: ["status"], where, _count: true }),
    ]);
    return {
      runs: agg._count,
      cacheHits,
      promptTokens: agg._sum.promptTokens ?? 0,
      completionTokens: agg._sum.completionTokens ?? 0,
      totalTokens: agg._sum.totalTokens ?? 0,
      averageLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count])),
    };
  },

  pruneSamplesOlderThan(cutoff: Date) {
    return prisma.analysisRunSample.deleteMany({ where: { createdAt: { lt: cutoff } } });
  },
};
