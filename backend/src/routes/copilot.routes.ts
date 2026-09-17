import { Router } from "express";
import { copilotController } from "../controllers/copilot.controller";
import { authenticate } from "../middleware/auth.middleware";
import { uploadVoiceClip } from "../middleware/upload.middleware";

const router = Router();

router.use(authenticate);

router.post("/chat", copilotController.chat);
router.post("/voice", uploadVoiceClip.single("audio"), copilotController.voice);
router.post("/transcribe", uploadVoiceClip.single("audio"), copilotController.transcribe);
router.get("/sessions", copilotController.listSessions);
router.get("/sessions/:id", copilotController.getSession);
router.delete("/sessions/:id", copilotController.deleteSession);

export default router;
