import { prisma } from "../database/prismaClient";
import { Prisma, ReportType, Priority } from "@prisma/client";

export const reportRepository = {
  create(data: { facultyId: number; reportType: ReportType; resultJson: Prisma.InputJsonValue }) {
    return prisma.analysisReport.create({ data });
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

  addRecommendations(reportId: number, recs: { message: string; priority: Priority }[]) {
    return prisma.recommendation.createMany({
      data: recs.map((r) => ({ ...r, reportId })),
    });
  },
};
