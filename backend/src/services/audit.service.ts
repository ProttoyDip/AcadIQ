import { prisma } from "../database/prismaClient";

export interface CreateAuditLogInput {
  userId?: number;
  action: string;
  document?: string;
}

export const auditService = {
  async recordAuditLog(input: CreateAuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          document: input.document ?? null,
        },
      });
    } catch (error) {
      console.error("[AuditLog] Failed to record audit entry:", error);
    }
  },

  async getAuditLogs(options?: { page?: number; limit?: number; userId?: number }) {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const skip = (page - 1) * limit;

    const where = options?.userId ? { userId: options.userId } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

