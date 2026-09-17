import { prisma } from "../database/prismaClient";

export const courseRepository = {
  findAllByFaculty(facultyId: number) {
    return prisma.course.findMany({ where: { facultyId }, orderBy: { createdAt: "desc" } });
  },

  /**
   * Deletes a course and reports what went with it. The counts are taken inside the
   * transaction because the FK cascade removes those rows before we could read them
   * afterwards. Timetable rows (slots, sessions, calendar events) are SET NULL in the
   * schema, so they survive detached from the course rather than being destroyed —
   * reported separately so the caller can say so instead of implying they were kept intact.
   */
  remove(id: number) {
    return prisma.$transaction(async (tx) => {
      const [syllabusDocuments, questionPapers, reports, teachingMaterials, lecturePlans, detachedSessions] = await Promise.all([
        tx.syllabusDocument.count({ where: { courseId: id } }),
        tx.questionPaper.count({ where: { courseId: id } }),
        tx.analysisReport.count({ where: { courseId: id } }),
        tx.teachingMaterial.count({ where: { courseId: id } }),
        tx.lecturePlan.count({ where: { courseId: id } }),
        tx.classSession.count({ where: { courseId: id } }),
      ]);
      const course = await tx.course.delete({ where: { id } });
      return {
        id: course.id,
        courseCode: course.courseCode,
        deleted: { syllabusDocuments, questionPapers, reports, teachingMaterials, lecturePlans },
        detachedSessions,
      };
    });
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
