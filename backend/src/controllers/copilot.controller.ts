import { Response, NextFunction } from "express";
import { copilotService } from "../services/copilot.service";
import { copilotChatSchema, copilotVoiceSchema, transcribeSchema } from "../validators/copilot.validator";
import { success } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { parsePositiveId } from "../utils/parseId";
import { AppError } from "../middleware/error.middleware";
import { callLlmTranscription } from "../ai/llmClient";

export const copilotController = {
  async chat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = copilotChatSchema.parse(req.body);
      const result = await copilotService.chat(req.user!.userId, input);
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async voice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("A recorded audio clip is required", 400);
      const input = copilotVoiceSchema.parse(req.body ?? {});
      const result = await copilotService.voice(req.user!.userId, input, {
        buffer: req.file.buffer,
        filename: req.file.originalname || "voice.webm",
        mimeType: req.file.mimetype,
      });
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },

  /** Dictation for any text field: transcript only, no Copilot turn. */
  async transcribe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError("A recorded audio clip is required", 400);
      const { language } = transcribeSchema.parse(req.body ?? {});
      const transcript = await callLlmTranscription(
        { buffer: req.file.buffer, filename: req.file.originalname || "voice.webm", mimeType: req.file.mimetype },
        { language }
      );
      return success(res, { transcript });
    } catch (error) {
      next(error);
    }
  },

  async getSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sessionId = parsePositiveId(req.params.id);
      const session = await copilotService.getSession(req.user!.userId, sessionId);
      return success(res, session);
    } catch (error) {
      next(error);
    }
  },

  async listSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const courseId = req.query.courseId ? parsePositiveId(String(req.query.courseId)) : undefined;
      const sessions = await copilotService.listSessions(req.user!.userId, courseId);
      return success(res, sessions);
    } catch (error) {
      next(error);
    }
  },

  async deleteSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sessionId = parsePositiveId(req.params.id);
      const result = await copilotService.deleteSession(req.user!.userId, sessionId);
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },
};
