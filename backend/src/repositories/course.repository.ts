import { prisma } from "../database/prismaClient";

export const courseRepository = {
  findAllByFaculty(facultyId: number) {
    return prisma.course.findMany({ where: { facultyId }, orderBy: { createdAt: "desc" } });
  },

  findById(id: number) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        syllabusDocuments: {
          select: { id: true, courseId: true, originalName: true, mimeType: true, fileSize: true, uploadedAt: true },
        },
        questionPapers: {
          select: {
            id: true,
            courseId: true,
            year: true,
            semester: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
            questions: {
              include: {
                coMappings: {
                  include: {
                    courseOutcome: true,
                  },
                },
              },
            },
          },
        },
        courseOutcomes: { orderBy: { code: "asc" } },
      },
    });
  },

  findOwnedById(id: number, facultyId: number) {
    return prisma.course.findFirst({ where: { id, facultyId } });
  },

  findOutcomes(courseId: number) {
    return prisma.courseOutcome.findMany({ where: { courseId }, orderBy: { code: "asc" } });
  },

  create(data: { facultyId: number; courseCode: string; courseName: string; description?: string }) {
    return prisma.course.create({ data });
  },
};
