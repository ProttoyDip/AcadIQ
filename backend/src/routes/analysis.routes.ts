import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { memoryController } from "../controllers/memory.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));
router.post("/exam", analysisController.analyzeExam);
router.post("/memory", memoryController.check);
router.post("/co", analysisController.mapCourseOutcomes);
router.post("/syllabus", analysisController.analyzeSyllabus);
router.post("/similarity", analysisController.analyzeSimilarity);
router.post("/question-review", analysisController.reviewQuestions);
router.post("/co-mapping", analysisController.mapCourseOutcomes);
router.post("/dual-evaluate", analysisController.dualEvaluate);

export default router;

