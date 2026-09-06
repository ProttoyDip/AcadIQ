import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { uploadPdf } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate);
router.post("/syllabus", uploadPdf.single("file"), uploadController.uploadSyllabus);
router.post("/question-paper", uploadPdf.single("file"), uploadController.uploadQuestionPaper);

export default router;
