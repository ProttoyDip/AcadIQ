import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { courseController } from "../controllers/course.controller";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { questionSearchService } from "../services/questionSearch.service";
import { teachingMaterialService } from "../services/teachingMaterial.service";
import { success } from "../utils/apiResponse";
import { parsePositiveId } from "../utils/parseId";

const router = Router();

const searchQuery = z.object({
  q: z.string().trim().min(3).max(2000),
  k: z.coerce.number().int().min(1).max(50).default(10),
  floor: z.coerce.number().min(0).max(1).default(0.3),
});

router.use(authenticate, requireRole("FACULTY"));
router.get("/", courseController.list);
router.get("/:id/questions/search", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { q, k, floor } = searchQuery.parse(req.query);
    return success(res, await questionSearchService.search(req.user!.userId, parsePositiveId(req.params.id), q, k, floor));
  } catch (err) {
    next(err);
  }
});
router.get("/:id/materials", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return success(res, await teachingMaterialService.list(req.user!.userId, parsePositiveId(req.params.id)));
  } catch (err) {
    next(err);
  }
});
router.delete("/:id/materials/:materialId", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return success(res, await teachingMaterialService.remove(req.user!.userId, parsePositiveId(req.params.materialId)));
  } catch (err) {
    next(err);
  }
});
router.get("/:id", courseController.getById);
router.post("/", courseController.create);

export default router;
