import { Router } from "express";
import { copilotController } from "../controllers/copilot.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/chat", copilotController.chat);
router.get("/sessions", copilotController.listSessions);
router.get("/sessions/:id", copilotController.getSession);
router.delete("/sessions/:id", copilotController.deleteSession);

export default router;
