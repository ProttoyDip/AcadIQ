import { Router, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadRoutine } from "../middleware/upload.middleware";
import { AppError } from "../middleware/error.middleware";
import { success } from "../utils/apiResponse";
import { assistantService, chatSchema, executeSchema } from "../services/assistant/assistant.service";

const router = Router();
router.use(authenticate, requireRole("FACULTY", "ADMIN"));

const wrap = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

router.post("/chat", wrap(async (req, res) => success(res, await assistantService.chat(req.user!.userId, req.user!.role, chatSchema.parse(req.body)))));
router.post("/execute", wrap(async (req, res) => success(res, await assistantService.execute(req.user!.userId, req.user!.role, executeSchema.parse(req.body)))));
router.get("/tools", wrap(async (req, res) => success(res, assistantService.tools(req.user!.role))));

// Files dropped into the chat (routines as PDF/DOCX/photo); consumed by a tool after confirmation.
router.post(
  "/attachments",
  uploadRoutine.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw new AppError("File is required", 400);
    return success(res, assistantService.stageAttachment(req.user!.userId, req.file), 201);
  })
);
router.delete("/attachments/:id", wrap(async (req, res) => success(res, assistantService.discardAttachment(req.user!.userId, String(req.params.id)))));

export default router;
