import { Response, NextFunction } from "express";
import { reportService } from "../services/report.service";
import { reportPdfService } from "../services/reportPdf.service";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { parsePositiveId } from "../utils/parseId";

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
      const report = await reportService.getById(parsePositiveId(req.params.id), req.user!.userId);
      return success(res, report);
    } catch (err) {
      next(err);
    }
  },

  async downloadPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await reportPdfService.render(parsePositiveId(req.params.id), req.user!.userId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.length));
      return res.status(200).end(buffer);
    } catch (err) {
      next(err);
    }
  },
};
