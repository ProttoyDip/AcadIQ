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
import { materialUploadSchema, teachingMaterialService } from "../services/teachingMaterial.service";

async function removeRejectedUpload(path?: string) {
  if (path) await fs.unlink(path).catch(() => undefined);
}

function hideStoragePath<T extends { filePath: string }>(record: T): Omit<T, "filePath"> {
  const { filePath: _internalPath, ...publicRecord } = record;
  return publicRecord;
}

export const uploadController = {
  async uploadTeachingMaterials(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      if (!files.length) throw new AppError("At least one PDF, DOCX, PPTX, TXT or MD file is required", 400);
      const input = materialUploadSchema.parse(req.body);
      const results = [];
      const failures: Array<{ file: string; error: string }> = [];
      for (const file of files) {
        try {
          results.push(await teachingMaterialService.upload(req.user!.userId, { ...input, title: files.length === 1 ? input.title : undefined }, file));
        } catch (error) {
          await removeRejectedUpload(file.path);
          failures.push({ file: file.originalname, error: error instanceof Error ? error.message : String(error) });
        }
      }
      if (!results.length) throw new AppError(failures[0]?.error ?? "No material could be processed", 422, { failures });
      return success(res, { materials: results, failures }, 201);
    } catch (error) {
      await Promise.all(files.map((file) => removeRejectedUpload(file.path)));
      next(error);
    }
  },

  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("A PDF file or DOCX file is required", 400);
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
      if (!req.file) throw new AppError("A PDF file or DOCX file is required", 400);
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
      if (!req.file) throw new AppError("A PDF file or DOCX file is required", 400);
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
