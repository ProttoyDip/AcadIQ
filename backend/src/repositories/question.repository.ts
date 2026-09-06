import { prisma } from "../database/prismaClient";

export const questionRepository = {
  createMany(paperId: number, questions: { questionText: string; marks: number; topic?: string; bloomLevel?: string }[]) {
    return prisma.question.createMany({
      data: questions.map((q) => ({ ...q, paperId })),
    });
  },

  findByPaperId(paperId: number) {
    return prisma.question.findMany({ where: { paperId } });
  },
};
