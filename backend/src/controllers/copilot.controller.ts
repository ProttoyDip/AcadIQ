import { Response, NextFunction } from "express";
import { copilotService } from "../services/copilot.service";
import { copilotChatSchema } from "../validators/copilot.validator";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { parsePositiveId } from "../utils/parseId";

export const copilotController = {
  async chat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = copilotChatSchema.parse(req.body);
      const result = await copilotService.chat(req.user!.userId, input);
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sessionId = parsePositiveId(req.params.id);
      const session = await copilotService.getSession(req.user!.userId, sessionId);
      return success(res, session);
    } catch (error) {
      next(error);
    }
  },

  async listSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const courseId = req.query.courseId ? parsePositiveId(String(req.query.courseId)) : undefined;
      const sessions = await copilotService.listSessions(req.user!.userId, courseId);
      return success(res, sessions);
    } catch (error) {
      next(error);
    }
  },

  async deleteSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sessionId = parsePositiveId(req.params.id);
      const result = await copilotService.deleteSession(req.user!.userId, sessionId);
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },
};
