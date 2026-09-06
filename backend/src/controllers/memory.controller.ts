import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { academicMemoryService } from "../services/academicMemory.service";
import { success } from "../utils/apiResponse";
import { memoryCheckSchema } from "../validators/analysis.validator";

export const memoryController = {
  async check(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = memoryCheckSchema.parse(req.body);
      return success(res, await academicMemoryService.check(req.user!.userId, input), 201);
    } catch (error) {
      next(error);
    }
  },
};
