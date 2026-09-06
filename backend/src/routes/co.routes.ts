import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.post("/analyze", analysisController.mapCourseOutcomes);

export default router;
