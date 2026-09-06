import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { uploadDocument } from "../middleware/upload.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
router.use(authenticate, requireRole("FACULTY"));
router.post("/upload", uploadDocument.single("file"), uploadController.upload);

export default router;
