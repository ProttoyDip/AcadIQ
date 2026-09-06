import { Response, NextFunction } from "express";
import { uploadService } from "../services/upload.service";
import { success } from "../utils/apiResponse";
import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const uploadController = {
  async uploadSyllabus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("No file uploaded", 400);
      const courseId = Number(req.body.courseId);
      const doc = await uploadService.uploadSyllabus(courseId, req.file.path);
      return success(res, doc, 201);
    } catch (err) {
      next(err);
    }
  },

  async uploadQuestionPaper(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("No file uploaded", 400);
      const { courseId, year, semester } = req.body;
      const paper = await uploadService.uploadQuestionPaper(
        Number(courseId),
        Number(year),
        semester,
        req.file.path
      );
      return success(res, paper, 201);
    } catch (err) {
      next(err);
    }
  },
};
