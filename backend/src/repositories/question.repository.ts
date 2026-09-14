import { prisma } from "../database/prismaClient";

export const questionRepository = {
  createMany(paperId: number, questions: { sequenceNumber: number; questionText: string; marks: number; topic?: string; bloomLevel?: string }[]) {
    return prisma.question.createMany({
      data: questions.map((q) => ({ ...q, paperId })),
    });
  },

  findByPaperId(paperId: number) {
    return prisma.question.findMany({ where: { paperId } });
  },

  /** Persists AI labels so Bloom drift / topic trends become a plain query instead of a resultJson dig. */
  async saveLabels(labels: Array<{ questionId: number; bloomLevel: string; topic: string }>) {
    if (!labels.length) return;
    await prisma.$transaction(
      labels.map((label) =>
        prisma.question.update({
          where: { id: label.questionId },
          data: { bloomLevel: label.bloomLevel, topic: label.topic.slice(0, 191) || null },
        })
      )
    );
  },
};
