import { Response, NextFunction } from "express";
import { courseService } from "../services/course.service";
import { createCourseSchema } from "../validators/course.validator";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const courseController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const courses = await courseService.listForFaculty(req.user!.userId);
      return success(res, courses);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const course = await courseService.getById(Number(req.params.id), req.user!.userId);
      return success(res, course);
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = createCourseSchema.parse(req.body);
      const course = await courseService.create(req.user!.userId, input);
      return success(res, course, 201);
    } catch (err) {
      next(err);
    }
  },
};
