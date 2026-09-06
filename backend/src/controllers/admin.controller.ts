import { Response, NextFunction } from "express";
import { userRepository } from "../repositories/user.repository";
import { auditService } from "../services/audit.service";
import { success, failure } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { parsePositiveId } from "../utils/parseId";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "FACULTY"]),
});

export const adminController = {
  async listUsers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await userRepository.listAll();
      return success(res, users);
    } catch (error) {
      next(error);
    }
  },

  async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetUserId = parsePositiveId(req.params.id);
      const parsed = updateRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return failure(res, "Invalid role. Allowed values: ADMIN, FACULTY", 400);
      }

      const updated = await userRepository.updateRole(targetUserId, parsed.data.role);

      await auditService.recordAuditLog({
        userId: req.user!.userId,
        action: `Admin updated user ${targetUserId} role to ${parsed.data.role}`,
      });

      return success(res, updated);
    } catch (error) {
      next(error);
    }
  },

  async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetUserId = parsePositiveId(req.params.id);
      if (targetUserId === req.user!.userId) {
        return failure(res, "Administrators cannot delete their own account", 400);
      }

      await userRepository.deleteUser(targetUserId);

      await auditService.recordAuditLog({
        userId: req.user!.userId,
        action: `Admin deleted user ${targetUserId}`,
      });

      return success(res, { message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  },

  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;

      const result = await auditService.getAuditLogs({ page, limit, userId });
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },
};

