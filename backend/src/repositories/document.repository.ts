import { prisma } from "../database/prismaClient";

export const documentRepository = {
  createSyllabusDocument(courseId: number, filePath: string) {
    return prisma.syllabusDocument.create({ data: { courseId, filePath } });
  },

  createQuestionPaper(data: { courseId: number; year: number; semester: string; filePath: string }) {
    return prisma.questionPaper.create({ data });
  },

  findQuestionPaperById(id: number) {
    return prisma.questionPaper.findUnique({ where: { id }, include: { questions: true } });
  },

  findLatestSyllabus(courseId: number) {
    return prisma.syllabusDocument.findFirst({ where: { courseId }, orderBy: { uploadedAt: "desc" } });
  },
};
