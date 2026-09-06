import { prisma } from "../database/prismaClient";
import { Prisma, ReportType, Priority } from "@prisma/client";

type ReportTypeValue = "EXAM_QUALITY" | "SYLLABUS_COVERAGE" | "QUESTION_SIMILARITY" | "QUESTION_REVIEW" | "CO_MAPPING";
type PriorityValue = "LOW" | "MEDIUM" | "HIGH";

export const reportRepository = {
  create(data: {
    facultyId: number;
    courseId?: number;
    questionPaperId?: number;
    reportType: ReportTypeValue;
    resultJson: unknown;
  }) {
    return prisma.analysisReport.create({
      data: {
        ...data,
        reportType: data.reportType as ReportType,
        resultJson: data.resultJson as Prisma.InputJsonValue,
      },
    });
  },

  findById(id: number) {
    return prisma.analysisReport.findUnique({
      where: { id },
      include: { recommendations: true },
    });
  },

  findAllByFaculty(facultyId: number) {
    return prisma.analysisReport.findMany({
      where: { facultyId },
      orderBy: { createdAt: "desc" },
      include: { recommendations: true },
    });
  },

  addRecommendations(reportId: number, recs: { message: string; priority: PriorityValue }[]) {
    return prisma.recommendation.createMany({
      data: recs.map((r) => ({ ...r, priority: r.priority as Priority, reportId })),
    });
  },

  createWithRecommendations(
    data: {
      facultyId: number;
      courseId?: number;
      questionPaperId?: number;
      reportType: ReportTypeValue;
      resultJson: unknown;
    },
    recommendations: { message: string; priority: PriorityValue }[]
  ) {
    return prisma.analysisReport.create({
      data: {
        ...data,
        reportType: data.reportType as ReportType,
        resultJson: data.resultJson as Prisma.InputJsonValue,
        recommendations: recommendations.length
          ? { create: recommendations.map((item) => ({ ...item, priority: item.priority as Priority })) }
          : undefined,
      },
      include: { recommendations: true },
    });
  },
};
