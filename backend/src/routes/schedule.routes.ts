import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadTeachingMaterial } from "../middleware/upload.middleware";
import { success } from "../utils/apiResponse";
import { parsePositiveId } from "../utils/parseId";
import {
  cancelSchema,
  eventsBulkSchema,
  logSchema,
  noticeSchema,
  rangeQuerySchema,
  replanSchema,
  rescheduleSchema,
  scheduleService,
  sessionCreateSchema,
  sessionUpdateSchema,
  slotsBulkSchema,
  termSchema,
  termUpdateSchema,
} from "../services/schedule/schedule.service";
import { routineImportService } from "../services/schedule/routineImport.service";
import { AppError } from "../middleware/error.middleware";

const router = Router();
router.use(authenticate, requireRole("FACULTY"));

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const wrap = (handler: Handler) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};
const uid = (req: AuthenticatedRequest) => req.user!.userId;
const termId = (req: AuthenticatedRequest) => parsePositiveId(req.params.termId, "termId");
const sessionId = (req: AuthenticatedRequest) => parsePositiveId(req.params.sessionId, "sessionId");

// Terms
router.get("/terms", wrap(async (req, res) => success(res, await scheduleService.listTerms(uid(req)))));
router.post("/terms", wrap(async (req, res) => success(res, await scheduleService.createTerm(uid(req), termSchema.parse(req.body)), 201)));
router.patch(
  "/terms/:termId",
  wrap(async (req, res) => success(res, await scheduleService.updateTerm(uid(req), termId(req), termUpdateSchema.parse(req.body))))
);
router.delete("/terms/:termId", wrap(async (req, res) => success(res, await scheduleService.deleteTerm(uid(req), termId(req)))));

// Slots
router.get("/terms/:termId/slots", wrap(async (req, res) => success(res, await scheduleService.listSlots(uid(req), termId(req)))));
router.post("/terms/:termId/slots", wrap(async (req, res) => success(res, await scheduleService.saveSlots(uid(req), termId(req), slotsBulkSchema.parse(req.body)), 201)));
router.delete("/terms/:termId/slots/:slotId", wrap(async (req, res) => success(res, await scheduleService.deleteSlot(uid(req), termId(req), parsePositiveId(req.params.slotId, "slotId")))));

// Routine import (AI extraction; review before saving)
router.post(
  "/routine/extract",
  uploadTeachingMaterial.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw new AppError("Routine file is required", 400);
    const options = z.object({ facultyName: z.string().trim().max(120).optional(), initials: z.string().trim().max(12).optional() }).parse(req.body ?? {});
    return success(res, await routineImportService.extract(uid(req), req.file, options));
  })
);

// Calendar events
router.get("/terms/:termId/events", wrap(async (req, res) => success(res, await scheduleService.listEvents(uid(req), termId(req)))));
router.post("/terms/:termId/events", wrap(async (req, res) => success(res, await scheduleService.addEvents(uid(req), termId(req), eventsBulkSchema.parse(req.body)), 201)));
router.delete("/terms/:termId/events/:eventId", wrap(async (req, res) => success(res, await scheduleService.deleteEvent(uid(req), termId(req), parsePositiveId(req.params.eventId, "eventId")))));

// Sessions
router.get("/terms/:termId/sessions", wrap(async (req, res) => success(res, await scheduleService.listSessions(uid(req), termId(req), rangeQuerySchema.parse(req.query)))));
router.post("/terms/:termId/sessions", wrap(async (req, res) => success(res, await scheduleService.createSession(uid(req), termId(req), sessionCreateSchema.parse(req.body)), 201)));
router.get("/terms/:termId/makeup-debt", wrap(async (req, res) => success(res, await scheduleService.makeupDebt(uid(req), termId(req)))));
router.get(
  "/terms/:termId/calendar.ics",
  wrap(async (req, res) => {
    const { filename, content } = await scheduleService.ics(uid(req), termId(req));
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(content);
  })
);

router.patch("/sessions/:sessionId", wrap(async (req, res) => success(res, await scheduleService.updateSession(uid(req), sessionId(req), sessionUpdateSchema.parse(req.body)))));
router.delete("/sessions/:sessionId", wrap(async (req, res) => success(res, await scheduleService.deleteSession(uid(req), sessionId(req)))));
router.post("/sessions/:sessionId/cancel", wrap(async (req, res) => success(res, await scheduleService.cancelSession(uid(req), sessionId(req), cancelSchema.parse(req.body ?? {})))));
router.post("/sessions/:sessionId/restore", wrap(async (req, res) => success(res, await scheduleService.restoreSession(uid(req), sessionId(req)))));
router.get("/sessions/:sessionId/suggestions", wrap(async (req, res) => success(res, await scheduleService.suggestReschedule(uid(req), sessionId(req)))));
router.post("/sessions/:sessionId/reschedule", wrap(async (req, res) => success(res, await scheduleService.rescheduleSession(uid(req), sessionId(req), rescheduleSchema.parse(req.body)), 201)));
router.post("/sessions/:sessionId/log", wrap(async (req, res) => success(res, await scheduleService.logSession(uid(req), sessionId(req), logSchema.parse(req.body)))));
router.post("/sessions/:sessionId/notice", wrap(async (req, res) => success(res, await scheduleService.noticeDraft(uid(req), sessionId(req), noticeSchema.parse(req.body ?? {})))));

// Briefing + pace
router.get("/today", wrap(async (req, res) => success(res, await scheduleService.today(uid(req), typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : undefined))));
router.get("/pace/:courseId", wrap(async (req, res) => success(res, await scheduleService.pace(uid(req), parsePositiveId(req.params.courseId, "courseId")))));
router.post("/replan", wrap(async (req, res) => success(res, await scheduleService.replan(uid(req), replanSchema.parse(req.body)))));

export default router;
