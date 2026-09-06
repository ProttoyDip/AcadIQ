import { prisma } from "../database/prismaClient";
import { ChatRole, Prisma } from "@prisma/client";

export const copilotRepository = {
  // --- ChatSession Methods (New standard models) ---
  createSession(data: {
    userId: number;
    courseId?: number;
    examId?: number;
    title: string;
  }) {
    return prisma.chatSession.create({
      data: {
        userId: data.userId,
        courseId: data.courseId ?? null,
        examId: data.examId ?? null,
        title: data.title,
      },
    });
  },

  findSessionById(id: number, userId: number) {
    return prisma.chatSession.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        contexts: {
          orderBy: { createdAt: "asc" },
        },
        course: {
          select: {
            courseCode: true,
            courseName: true,
          },
        },
        exam: {
          select: {
            id: true,
            originalName: true,
            semester: true,
            year: true,
          },
        },
      },
    });
  },

  listSessions(userId: number, courseId?: number) {
    const where: any = { userId };
    if (courseId) where.courseId = courseId;

    return prisma.chatSession.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        course: {
          select: {
            courseCode: true,
            courseName: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
  },

  deleteSession(id: number, userId: number) {
    return prisma.chatSession.deleteMany({
      where: { id, userId },
    });
  },

  addChatMessage(data: {
    sessionId: number;
    role: ChatRole;
    content: string;
    aiReasoning?: string;
    confidence?: number;
  }) {
    return prisma.chatMessage.create({
      data: {
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        aiReasoning: data.aiReasoning ?? null,
        confidence: data.confidence !== undefined ? new Prisma.Decimal(data.confidence) : null,
      },
    });
  },

  addCopilotContext(data: {
    sessionId: number;
    sourceType: string;
    sourceId?: number;
    content: string;
  }) {
    return prisma.copilotContext.create({
      data: {
        sessionId: data.sessionId,
        sourceType: data.sourceType,
        sourceId: data.sourceId ?? null,
        content: data.content,
      },
    });
  },

  getRecentSessionMessages(sessionId: number, limit = 12) {
    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }).then((msgs) => msgs.reverse());
  },

  touchSession(id: number) {
    return prisma.chatSession.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  },

  // --- Legacy Thread Methods (Maintained for backward compatibility) ---
  createThread(data: {
    facultyId: number;
    courseId: number;
    questionPaperId?: number;
    reportId?: number;
    title: string;
  }) {
    return prisma.copilotThread.create({
      data: {
        facultyId: data.facultyId,
        courseId: data.courseId,
        questionPaperId: data.questionPaperId ?? null,
        reportId: data.reportId ?? null,
        title: data.title,
      },
    });
  },

  findThreadById(id: number, facultyId: number) {
    return prisma.copilotThread.findFirst({
      where: { id, facultyId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        course: {
          select: {
            courseCode: true,
            courseName: true,
          },
        },
      },
    });
  },

  listThreads(facultyId: number, courseId?: number) {
    const where: any = { facultyId };
    if (courseId) where.courseId = courseId;

    return prisma.copilotThread.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        course: {
          select: {
            courseCode: true,
            courseName: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
  },

  deleteThread(id: number, facultyId: number) {
    return prisma.copilotThread.deleteMany({
      where: { id, facultyId },
    });
  },

  createMessage(data: {
    threadId: number;
    role: "user" | "assistant" | "system";
    content: string;
    citations?: any;
  }) {
    return prisma.copilotMessage.create({
      data: {
        threadId: data.threadId,
        role: data.role,
        content: data.content,
        citations: data.citations ?? null,
      },
    });
  },

  getRecentMessages(threadId: number, limit = 12) {
    return prisma.copilotMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }).then((msgs) => msgs.reverse());
  },

  touchThread(id: number) {
    return prisma.copilotThread.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  },
};
