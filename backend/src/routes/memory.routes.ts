import { Router } from "express";
import { memoryController } from "../controllers/memory.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.post("/check", memoryController.check);

export default router;
