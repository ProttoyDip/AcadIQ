import { Router, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { feedbackService, questionFeedbackSchema } from "../services/feedback.service";
import { success } from "../utils/apiResponse";
import { parsePositiveId } from "../utils/parseId";

const router = Router();
router.use(authenticate, requireRole("FACULTY"));

router.post("/questions", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = questionFeedbackSchema.parse(req.body);
    return success(res, await feedbackService.submit(req.user!.userId, input), 201);
  } catch (err) {
    next(err);
  }
});

router.get("/reports/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return success(res, await feedbackService.listForReport(req.user!.userId, parsePositiveId(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = typeof req.query.courseId === "string" ? parsePositiveId(req.query.courseId) : undefined;
    return success(res, await feedbackService.stats(req.user!.userId, courseId));
  } catch (err) {
    next(err);
  }
});

export default router;
