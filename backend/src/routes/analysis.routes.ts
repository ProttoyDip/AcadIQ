import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { memoryController } from "../controllers/memory.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

import { uploadReferenceScheme } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));
router.post("/exam", analysisController.analyzeExam);
router.post("/memory", memoryController.check);
router.post("/co", analysisController.mapCourseOutcomes);
router.post("/syllabus", analysisController.analyzeSyllabus);
router.post("/similarity", analysisController.analyzeSimilarity);
router.post("/question-review", analysisController.reviewQuestions);
router.post("/co-mapping", analysisController.mapCourseOutcomes);
router.post(
  "/dual-evaluate",
  (req, res, next) => {
    uploadReferenceScheme.any()(req, res, (err) => {
      if (err) return next(err);
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        req.file = req.files[0];
      }
      next();
    });
  },
  analysisController.dualEvaluate
);


export default router;

