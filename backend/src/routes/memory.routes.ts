import { Router } from "express";
import { memoryController } from "../controllers/memory.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(authenticate, requireRole("FACULTY"));
router.post("/check", memoryController.check);

export default router;
