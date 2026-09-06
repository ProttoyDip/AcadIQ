import { promises as fs } from "fs";
import { NextFunction, Response } from "express";
import { uploadService } from "../services/upload.service";
import { success } from "../utils/apiResponse";
import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  documentUploadSchema,
  questionPaperUploadSchema,
  syllabusUploadSchema,
} from "../validators/document.validator";

async function removeRejectedUpload(path?: string) {
  if (path) await fs.unlink(path).catch(() => undefined);
}

function hideStoragePath<T extends { filePath: string }>(record: T): Omit<T, "filePath"> {
  const { filePath: _internalPath, ...publicRecord } = record;
  return publicRecord;
}

export const uploadController = {
  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("A PDF file is required", 400);
      const input = documentUploadSchema.parse(req.body);
      const result = input.documentType === "SYLLABUS"
        ? await uploadService.uploadSyllabus(req.user!.userId, input.courseId, req.file)
        : await uploadService.uploadQuestionPaper(
            req.user!.userId,
            input.courseId,
            input.year,
            input.semester,
            req.file
          );
      return success(res, hideStoragePath(result), 201);
    } catch (error) {
      await removeRejectedUpload(req.file?.path);
      next(error);
    }
  },

  async uploadSyllabus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("A PDF file is required", 400);
      const input = syllabusUploadSchema.parse(req.body);
      const doc = await uploadService.uploadSyllabus(req.user!.userId, input.courseId, req.file);
      return success(res, hideStoragePath(doc), 201);
    } catch (error) {
      await removeRejectedUpload(req.file?.path);
      next(error);
    }
  },

  async uploadQuestionPaper(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("A PDF file is required", 400);
      const input = questionPaperUploadSchema.parse(req.body);
      const paper = await uploadService.uploadQuestionPaper(
        req.user!.userId,
        input.courseId,
        input.year,
        input.semester,
        req.file
      );
      return success(res, hideStoragePath(paper), 201);
    } catch (error) {
      await removeRejectedUpload(req.file?.path);
      next(error);
    }
  },
};
