import { prisma } from "../database/prismaClient";

export const courseRepository = {
  findAllByFaculty(facultyId: number) {
    return prisma.course.findMany({ where: { facultyId }, orderBy: { createdAt: "desc" } });
  },

  findById(id: number) {
    return prisma.course.findUnique({
      where: { id },
      include: { syllabusDocuments: true, questionPapers: { include: { questions: true } } },
    });
  },

  create(data: { facultyId: number; courseCode: string; courseName: string; description?: string }) {
    return prisma.course.create({ data });
  },
};
