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
  dualEvaluationSchema,
} from "../validators/analysis.validator";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { questionReviewService } from "../services/questionReview.service";
import { coMappingService } from "../services/coMapping.service";
import { dualEvaluationService } from "../services/dualEvaluation.service";

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
      const { question, maxMarks, modelAnswer, studentAnswer } = dualEvaluationSchema.parse(req.body);
      const result = await dualEvaluationService.evaluate(String(req.user!.userId), {
        question,
        maxMarks,
        modelAnswer,
        studentAnswer,
      });
      return success(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

};

