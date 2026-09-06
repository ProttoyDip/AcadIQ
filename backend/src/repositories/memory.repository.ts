import { prisma } from "../database/prismaClient";

export const memoryRepository = {
  findHistoricalQuestions(courseId: number, excludedSourceQuestionIds: number[] = []) {
    return prisma.questionHistory.findMany({
      where: {
        courseId,
        sourceQuestionId: excludedSourceQuestionIds.length ? { notIn: excludedSourceQuestionIds } : undefined,
      },
      orderBy: [{ year: "desc" }, { semester: "desc" }],
      take: 500,
    });
  },

  async recordSimilarityScores(matches: Array<{ historicalQuestionId: number; similarityScore: number }>) {
    await prisma.$transaction(
      matches.map((match) => prisma.questionHistory.updateMany({
        where: { id: match.historicalQuestionId },
        data: { similarityScore: match.similarityScore },
      }))
    );
  },
};
