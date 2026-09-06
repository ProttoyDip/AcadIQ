import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/auth.validator";
import { success } from "../utils/apiResponse";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      return success(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);
      return success(res, result);
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(input);
      return success(res, result);
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(input);
      return success(res, result);
    } catch (err) {
      next(err);
    }
  },
};
