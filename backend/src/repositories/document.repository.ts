import { prisma } from "../database/prismaClient";
import { Prisma } from "@prisma/client";

export const documentRepository = {
  createSyllabusDocument(data: {
    courseId: number;
    filePath: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }) {
    return prisma.syllabusDocument.create({ data });
  },

  createQuestionPaper(data: {
    courseId: number;
    year: number;
    semester: string;
    filePath: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }) {
    return prisma.questionPaper.create({ data });
  },

  createQuestionPaperWithQuestions(
    data: {
      courseId: number;
      year: number;
      semester: string;
      filePath: string;
      originalName: string;
      mimeType: string;
      fileSize: number;
    },
    questions: { sequenceNumber: number; questionText: string; marks: number }[]
  ) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const paper = await tx.questionPaper.create({ data });
      await tx.question.createMany({ data: questions.map((question) => ({ ...question, paperId: paper.id })) });
      const storedQuestions = await tx.question.findMany({ where: { paperId: paper.id } });
      if (storedQuestions.length) {
        await tx.questionHistory.createMany({
          data: storedQuestions.map((question) => ({
            courseId: data.courseId,
            sourceQuestionId: question.id,
            questionText: question.questionText,
            semester: data.semester,
            year: data.year,
          })),
        });
      }
      return tx.questionPaper.findUniqueOrThrow({
        where: { id: paper.id },
        include: { questions: { orderBy: { sequenceNumber: "asc" } } },
      });
    });
  },

  findQuestionPaperById(id: number) {
    return prisma.questionPaper.findUnique({ where: { id }, include: { questions: true } });
  },

  findLatestSyllabus(courseId: number) {
    return prisma.syllabusDocument.findFirst({ where: { courseId }, orderBy: { uploadedAt: "desc" } });
  },

  deleteQuestionPaper(id: number) {
    return prisma.questionPaper.delete({ where: { id } });
  },
};
