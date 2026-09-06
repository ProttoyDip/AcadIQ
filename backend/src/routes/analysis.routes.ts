import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);
router.post("/exam", analysisController.analyzeExam);
router.post("/syllabus", analysisController.analyzeSyllabus);
router.post("/similarity", analysisController.analyzeSimilarity);

export default router;
