import { Prisma, Priority, ReportType } from "@prisma/client";
import { prisma } from "../database/prismaClient";
import { AIExplanationResult, ExamQualityResult, PriorityValue } from "../models/types";

type ReportTypeValue =
  | "EXAM_QUALITY"
  | "SYLLABUS_COVERAGE"
  | "QUESTION_SIMILARITY"
  | "QUESTION_REVIEW"
  | "CO_MAPPING"
  | "ACADEMIC_MEMORY";

interface ReportData {
  facultyId: number;
  courseId?: number;
  questionPaperId?: number;
  reportType: ReportTypeValue;
  resultJson: unknown;
}

interface CoMappingPersistence {
  questionId: number;
  courseOutcome: string;
  strength: string;
  decision: string;
  reason: string;
  confidence: number;
}

function recommendationCreates(recommendations: Array<{ message: string; priority: PriorityValue }>) {
  return recommendations.map((item) => ({ ...item, priority: item.priority as Priority }));
}

function reportCreateData(
  data: ReportData,
  recommendations: Array<{ message: string; priority: PriorityValue }>,
  explanation: AIExplanationResult
) {
  return {
    facultyId: data.facultyId,
    courseId: data.courseId,
    questionPaperId: data.questionPaperId,
    reportType: data.reportType as ReportType,
    resultJson: data.resultJson as Prisma.InputJsonValue,
    recommendations: recommendations.length ? { create: recommendationCreates(recommendations) } : undefined,
    explanation: {
      create: {
        module: data.reportType,
        decision: explanation.decision,
        reason: explanation.reason,
        confidence: explanation.confidence,
      },
    },
  };
}

const completeReportInclude = {
  recommendations: true,
  explanation: true,
  examQualityScore: true,
  coMappings: { include: { courseOutcome: true } },
} as const;

export const reportRepository = {
  createExplainable(
    data: ReportData,
    recommendations: Array<{ message: string; priority: PriorityValue }>,
    explanation: AIExplanationResult
  ) {
    return prisma.analysisReport.create({
      data: reportCreateData(data, recommendations, explanation),
      include: completeReportInclude,
    });
  },

  createExamAnalysis(data: ReportData, result: ExamQualityResult) {
    return prisma.analysisReport.create({
      data: {
        ...reportCreateData(data, result.recommendations, result.explanation),
        examQualityScore: {
          create: {
            qualityScore: result.qualityScore,
            scoreFactors: result.scoreFactors as unknown as Prisma.InputJsonValue,
            positivePoints: result.positivePoints as Prisma.InputJsonValue,
            issues: result.issues as unknown as Prisma.InputJsonValue,
            recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
            confidenceScore: result.explanation.confidence,
          },
        },
      },
      include: completeReportInclude,
    });
  },

  async createCoAnalysis(
    data: ReportData,
    recommendations: Array<{ message: string; priority: PriorityValue }>,
    explanation: AIExplanationResult,
    outcomes: Array<{ code: string; description: string }>,
    mappings: CoMappingPersistence[]
  ) {
    return prisma.$transaction(async (tx) => {
      const report = await tx.analysisReport.create({
        data: reportCreateData(data, recommendations, explanation),
      });
      const outcomeIds = new Map<string, number>();
      for (const outcome of outcomes) {
        const stored = await tx.courseOutcome.upsert({
          where: { courseId_code: { courseId: data.courseId!, code: outcome.code } },
          create: { courseId: data.courseId!, code: outcome.code, description: outcome.description },
          update: { description: outcome.description },
        });
        outcomeIds.set(stored.code, stored.id);
      }
      if (mappings.length) {
        await tx.questionCOMapping.createMany({
          data: mappings.map((mapping) => ({
            reportId: report.id,
            questionId: mapping.questionId,
            courseOutcomeId: outcomeIds.get(mapping.courseOutcome)!,
            strength: mapping.strength,
            decision: mapping.decision,
            reason: mapping.reason,
            confidence: mapping.confidence,
          })),
        });
      }
      return tx.analysisReport.findUniqueOrThrow({ where: { id: report.id }, include: completeReportInclude });
    });
  },

  findById(id: number) {
    return prisma.analysisReport.findUnique({ where: { id }, include: completeReportInclude });
  },

  findAllByFaculty(facultyId: number) {
    return prisma.analysisReport.findMany({
      where: { facultyId },
      orderBy: { createdAt: "desc" },
      include: { recommendations: true, explanation: true, examQualityScore: true },
    });
  },
};
