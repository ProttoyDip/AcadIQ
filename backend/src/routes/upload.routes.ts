import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { uploadDocument, uploadTeachingMaterial } from "../middleware/upload.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));
router.post("/syllabus", uploadDocument.single("file"), uploadController.uploadSyllabus);
router.post("/question-paper", uploadDocument.single("file"), uploadController.uploadQuestionPaper);
router.post("/material", uploadTeachingMaterial.array("files", 10), uploadController.uploadTeachingMaterials);

export default router;
