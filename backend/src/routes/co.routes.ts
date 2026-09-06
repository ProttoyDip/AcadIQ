import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(authenticate, requireRole("FACULTY"));
router.post("/analyze", analysisController.mapCourseOutcomes);

export default router;
