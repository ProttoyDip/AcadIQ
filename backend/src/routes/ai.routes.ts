import { Router } from "express";
import { aiController } from "../controllers/ai.controller";
import { authenticate } from "../middleware/auth.middleware";
import { uploadAiPdf, uploadAiImage, uploadAiCourseDoc } from "../middleware/aiUpload.middleware";

const router = Router();

// Public/semi-open status check
router.get("/status", aiController.getStatus);

// Authenticated AI routes
router.use(authenticate);

// Configured chat providers/models the user may pick from (no keys or endpoints).
router.get("/models", aiController.listModels);

// Documents collection
router.get("/documents", aiController.listDocuments);
router.get("/document/:id", aiController.getDocument);
router.delete("/document/:id", aiController.deleteDocument);

// Feature 1: PDF AI
router.post("/pdf/upload", uploadAiPdf.single("file"), aiController.uploadPdf);
router.post("/pdf/summarize", aiController.summarizePdf);
router.post("/pdf/ask", aiController.askPdf);

// Feature 2: Image AI
router.post("/image/analyze", uploadAiImage.single("file"), aiController.analyzeImage);

// Feature 3: Course Outline Question Generator
router.post("/course/generate-questions", uploadAiCourseDoc.single("file"), aiController.generateCourseQuestions);

export default router;
