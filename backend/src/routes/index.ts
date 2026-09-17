import { Router } from "express";
import authRoutes from "./auth.routes";
import courseRoutes from "./course.routes";
import uploadRoutes from "./upload.routes";
import analysisRoutes from "./analysis.routes";
import reportRoutes from "./report.routes";
import documentRoutes from "./document.routes";
import memoryRoutes from "./memory.routes";
import coRoutes from "./co.routes";
import adminRoutes from "./admin.routes";
import copilotRoutes from "./copilot.routes";
import feedbackRoutes from "./feedback.routes";
import paperRoutes from "./paper.routes";
import rubricRoutes from "./rubric.routes";
import scheduleRoutes from "./schedule.routes";
import aiRoutes from "./ai.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/courses", courseRoutes);
router.use("/upload", uploadRoutes);
router.use("/documents", documentRoutes);
router.use("/analysis", analysisRoutes);
router.use("/analyze", analysisRoutes); // backwards-compatible frontend alias
router.use("/reports", reportRoutes);
router.use("/memory", memoryRoutes);
router.use("/co", coRoutes);
router.use("/admin", adminRoutes);
router.use("/copilot", copilotRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/papers", paperRoutes);
router.use("/rubrics", rubricRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/ai", aiRoutes);

export default router;
