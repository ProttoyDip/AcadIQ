import { promises as fs } from "fs";
import path from "path";
import { Response, NextFunction } from "express";
import { examAnalysisService } from "../services/examAnalysis.service";
import { syllabusAnalysisService } from "../services/syllabusAnalysis.service";
import { similarityService } from "../services/similarity.service";
import {
  analyzeExamSchema,
  analyzeSyllabusSchema,
  analyzeSimilaritySchema,
  questionReviewSchema,
  coMappingSchema,
} from "../validators/analysis.validator";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { questionReviewService } from "../services/questionReview.service";
import { coMappingService } from "../services/coMapping.service";
import { dualEvaluationService } from "../services/dualEvaluation.service";
import { extractPdfText } from "../ai/pdfTextExtractor";
import { extractDocxText } from "../ai/documentTextExtractor";
import { AppError } from "../middleware/error.middleware";


async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const filePath = file.path;
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf" || file.mimetype === "application/pdf") {
      return await extractPdfText(filePath);
    } else if (
      ext === ".docx" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/msword"
    ) {
      return await extractDocxText(filePath);
    } else {
      return await fs.readFile(filePath, "utf-8");
    }
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
}

export const analysisController = {
  async analyzeExam(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = analyzeExamSchema.parse(req.body);
      const result = await examAnalysisService.analyze(req.user!.userId, input);
      return success(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async analyzeSyllabus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = analyzeSyllabusSchema.parse(req.body);
      const result = await syllabusAnalysisService.analyze(req.user!.userId, input);
      return success(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async analyzeSimilarity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = analyzeSimilaritySchema.parse(req.body);
      const result = await similarityService.analyze(req.user!.userId, input);
      return success(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async reviewQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = questionReviewSchema.parse(req.body);
      return success(res, await questionReviewService.analyze(req.user!.userId, input), 201);
    } catch (err) {
      next(err);
    }
  },

  async mapCourseOutcomes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = coMappingSchema.parse(req.body);
      return success(res, await coMappingService.analyze(req.user!.userId, input), 201);
    } catch (err) {
      next(err);
    }
  },

  async dualEvaluate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      let { question, maxMarks, modelAnswer, studentAnswer } = req.body;

      const files: Express.Multer.File[] = Array.isArray((req as any).files)
        ? (req as any).files
        : (req as any).file
        ? [(req as any).file]
        : [];

      let refFile = files.find(
        (f) => f.fieldname === "referenceFile" || f.fieldname === "modelFile" || f.fieldname === "reference"
      );
      let studentUploadedFile = files.find(
        (f) => f.fieldname === "studentFile" || f.fieldname === "studentAnswerFile" || f.fieldname === "student"
      );

      const unassigned = files.filter((f) => f !== refFile && f !== studentUploadedFile);
      if (!refFile && unassigned.length > 0) {
        refFile = unassigned.shift();
      }
      if (!studentUploadedFile && unassigned.length > 0) {
        studentUploadedFile = unassigned.shift();
      }

      if (refFile) {
        modelAnswer = await extractTextFromFile(refFile);
      }
      if (studentUploadedFile) {
        studentAnswer = await extractTextFromFile(studentUploadedFile);
      }

      for (const extra of unassigned) {
        await fs.unlink(extra.path).catch(() => undefined);
      }

      if (!modelAnswer || typeof modelAnswer !== "string" || !modelAnswer.trim()) {
        throw new AppError("Reference answer / marking scheme is required. Please provide text or upload a document (PDF, Word, or text file).", 400);
      }

      if (!studentAnswer || typeof studentAnswer !== "string" || !studentAnswer.trim()) {
        throw new AppError("Student's written answer is required. Please provide text or upload a document (PDF, Word, or text file).", 400);
      }

      const result = await dualEvaluationService.evaluate(String(req.user!.userId), {
        question: question || "Exam Question",
        maxMarks: Number(maxMarks) || 10,
        modelAnswer: modelAnswer.trim(),
        studentAnswer: studentAnswer.trim(),
      });
      return success(res, result, 200);
    } catch (err) {
      next(err);
    }
  },


};

