import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { authenticate } from "../middleware/auth.middleware";

import { uploadReferenceScheme } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate);
router.post("/exam", analysisController.analyzeExam);
router.post("/syllabus", analysisController.analyzeSyllabus);
router.post("/similarity", analysisController.analyzeSimilarity);
router.post("/question-review", analysisController.reviewQuestions);
router.post("/co-mapping", analysisController.mapCourseOutcomes);
router.post(
  "/dual-evaluate",
  uploadReferenceScheme.any(),
  analysisController.dualEvaluate
);


export default router;

