import { Router } from "express";
import { reportController } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));
router.get("/", reportController.list);
router.get("/:id/pdf", reportController.downloadPdf);
router.get("/:id/provenance", reportController.provenance);
router.get("/:id/provenance/runs/:runId/samples/:sampleIndex", reportController.provenanceSample);
router.post("/:id/reproduce", reportController.reproduce);
router.get("/:id/paper.pdf", reportController.exportPaperPdf);
router.get("/:id/paper.md", reportController.exportPaperText);
router.post("/:id/adopt-paper", reportController.adoptPaper);
router.get("/:id", reportController.getById);

export default router;
