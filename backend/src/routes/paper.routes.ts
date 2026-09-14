import { Router, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { marksAnalysisQuerySchema, marksService, marksUploadSchema } from "../services/marks.service";
import { success } from "../utils/apiResponse";
import { parsePositiveId } from "../utils/parseId";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));

type Handler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>;
const wrap = (handler: Handler) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await handler(req, res, next);
  } catch (err) {
    next(err);
  }
};

router.post(
  "/:paperId/marks",
  wrap(async (req, res) => success(res, await marksService.upload(req.user!.userId, parsePositiveId(req.params.paperId, "paperId"), marksUploadSchema.parse(req.body)), 201))
);
router.get(
  "/:paperId/marks",
  wrap(async (req, res) => success(res, await marksService.summary(req.user!.userId, parsePositiveId(req.params.paperId, "paperId"))))
);
router.get(
  "/:paperId/marks/analysis",
  wrap(async (req, res) =>
    success(res, await marksService.analyze(req.user!.userId, parsePositiveId(req.params.paperId, "paperId"), marksAnalysisQuerySchema.parse(req.query)))
  )
);
router.delete(
  "/:paperId/marks",
  wrap(async (req, res) => success(res, await marksService.remove(req.user!.userId, parsePositiveId(req.params.paperId, "paperId"))))
);

export default router;
