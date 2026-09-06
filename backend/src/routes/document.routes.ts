import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { uploadPdf } from "../middleware/upload.middleware";

const router = Router();
router.use(authenticate);
router.post("/upload", uploadPdf.single("file"), uploadController.upload);

export default router;
