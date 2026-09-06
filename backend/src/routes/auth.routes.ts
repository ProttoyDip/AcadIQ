import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authRateLimiter, forgotPasswordRateLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);
router.post("/forgot-password", forgotPasswordRateLimiter, authController.forgotPassword);
router.post("/reset-password", authRateLimiter, authController.resetPassword);

export default router;
