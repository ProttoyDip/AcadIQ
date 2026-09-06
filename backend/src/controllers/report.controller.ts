import { Response, NextFunction } from "express";
import { reportService } from "../services/report.service";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const reportController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reports = await reportService.listForFaculty(req.user!.userId);
      return success(res, reports);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const report = await reportService.getById(Number(req.params.id), req.user!.userId);
      return success(res, report);
    } catch (err) {
      next(err);
    }
  },
};
