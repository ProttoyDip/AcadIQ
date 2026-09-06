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
import { AppError } from "../middleware/error.middleware";


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

      if (req.file) {
        const filePath = req.file.path;
        try {
          const ext = path.extname(req.file.originalname).toLowerCase();
          if (ext === ".pdf" || req.file.mimetype === "application/pdf") {
            modelAnswer = await extractPdfText(filePath);
          } else {
            modelAnswer = await fs.readFile(filePath, "utf-8");
          }
        } finally {
          await fs.unlink(filePath).catch(() => undefined);
        }
      }

      if (!modelAnswer || typeof modelAnswer !== "string" || !modelAnswer.trim()) {
        throw new AppError("Reference answer / marking scheme is required. Please upload a PDF or text file.", 400);
      }

      const result = await dualEvaluationService.evaluate(String(req.user!.userId), {
        question: question || "Exam Question",
        maxMarks: Number(maxMarks) || 10,
        modelAnswer: modelAnswer.trim(),
        studentAnswer: studentAnswer || "",
      });
      return success(res, result, 200);
    } catch (err) {
      next(err);
    }
  },


};

