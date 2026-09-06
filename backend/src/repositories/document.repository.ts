import { prisma } from "../database/prismaClient";
import { Prisma } from "@prisma/client";

export const documentRepository = {
  createSyllabusDocument(facultyId: number, data: {
    courseId: number;
    filePath: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const document = await tx.syllabusDocument.create({ data });
      await tx.auditLog.create({
        data: { userId: facultyId, action: "Faculty uploaded syllabus", document: data.originalName },
      });
      return document;
    });
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
    facultyId: number,
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
      await tx.auditLog.create({
        data: { userId: facultyId, action: "Faculty uploaded exam paper", document: data.originalName },
      });
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

  findQuestionPapersByCourse(courseId: number) {
    return prisma.questionPaper.findMany({
      where: { courseId },
      orderBy: { uploadedAt: "desc" },
      include: { questions: true },
    });
  },

  deleteQuestionPaper(id: number) {
    return prisma.questionPaper.delete({ where: { id } });
  },
};
