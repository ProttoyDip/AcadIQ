import { Router, Response, NextFunction } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { rubricService } from "../services/rubric.service";
import { success } from "../utils/apiResponse";
import { parsePositiveId } from "../utils/parseId";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));

router.get("/:id.md", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { filename, content } = await rubricService.markdown(req.user!.userId, parsePositiveId(req.params.id));
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(content);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return success(res, await rubricService.get(req.user!.userId, parsePositiveId(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return success(res, await rubricService.remove(req.user!.userId, parsePositiveId(req.params.id)));
  } catch (err) {
    next(err);
  }
});

export default router;
