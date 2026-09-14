import { Response, NextFunction } from "express";
import { reportService } from "../services/report.service";
import { reportPdfService } from "../services/reportPdf.service";
import { provenanceService } from "../services/provenance.service";
import { adoptPaperSchema, generatedPaperService } from "../services/generatedPaper.service";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { parsePositiveId } from "../utils/parseId";

export const reportController = {
  async exportPaperPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { buffer, filename } = await generatedPaperService.exportPdf(parsePositiveId(req.params.id), req.user!.userId, req.query.annotations === "true");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.length));
      return res.status(200).end(buffer);
    } catch (err) {
      next(err);
    }
  },

  async exportPaperText(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text, filename } = await generatedPaperService.exportText(parsePositiveId(req.params.id), req.user!.userId, req.query.annotations === "true");
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(text);
    } catch (err) {
      next(err);
    }
  },

  async adoptPaper(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = adoptPaperSchema.parse(req.body);
      const paper = await generatedPaperService.adopt(parsePositiveId(req.params.id), req.user!.userId, input);
      const { filePath: _internal, ...publicPaper } = paper;
      return success(res, publicPaper, 201);
    } catch (err) {
      next(err);
    }
  },

  async provenance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return success(res, await provenanceService.forReport(parsePositiveId(req.params.id), req.user!.userId));
    } catch (err) {
      next(err);
    }
  },

  async provenanceSample(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sampleIndex = Number(req.params.sampleIndex);
      if (!Number.isInteger(sampleIndex) || sampleIndex < 0) throw new Error("Invalid sample index");
      return success(
        res,
        await provenanceService.sample(parsePositiveId(req.params.id), parsePositiveId(req.params.runId), sampleIndex, req.user!.userId)
      );
    } catch (err) {
      next(err);
    }
  },

  async reproduce(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return success(res, await provenanceService.reproduce(parsePositiveId(req.params.id), req.user!.userId), 201);
    } catch (err) {
      next(err);
    }
  },

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
