import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authRateLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

router.post("/register", authRateLimiter, authController.register);
router.post("/login", authRateLimiter, authController.login);

export default router;
