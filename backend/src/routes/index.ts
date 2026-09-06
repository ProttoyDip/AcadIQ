import { Router } from "express";
import authRoutes from "./auth.routes";
import courseRoutes from "./course.routes";
import uploadRoutes from "./upload.routes";
import analysisRoutes from "./analysis.routes";
import reportRoutes from "./report.routes";
import documentRoutes from "./document.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/courses", courseRoutes);
router.use("/upload", uploadRoutes);
router.use("/documents", documentRoutes);
router.use("/analysis", analysisRoutes);
router.use("/analyze", analysisRoutes); // backwards-compatible frontend alias
router.use("/reports", reportRoutes);

export default router;
