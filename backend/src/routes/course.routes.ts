import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { courseController } from "../controllers/course.controller";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { questionSearchService } from "../services/questionSearch.service";
import { teachingMaterialService } from "../services/teachingMaterial.service";
import { blueprintSchema, blueprintService } from "../services/blueprint.service";
import { questionBankQuerySchema, questionBankService } from "../services/questionBank.service";
import { rubricService } from "../services/rubric.service";
import { lecturePlanSchema, lecturePlanService } from "../services/lecturePlan.service";
import { materialGapService } from "../services/materialGap.service";
import { courseFileService } from "../services/courseFile.service";
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

// ---- Faculty workflows -------------------------------------------------------------
type Handler = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const wrap = (handler: Handler) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};
const courseId = (req: AuthenticatedRequest) => parsePositiveId(req.params.id);

router.get("/:id/blueprint", wrap(async (req, res) => success(res, await blueprintService.get(req.user!.userId, courseId(req)))));
router.put("/:id/blueprint", wrap(async (req, res) => success(res, await blueprintService.save(req.user!.userId, courseId(req), blueprintSchema.parse(req.body)))));
router.get(
  "/:id/blueprint/compare/:paperId",
  wrap(async (req, res) => success(res, await blueprintService.compare(req.user!.userId, courseId(req), parsePositiveId(req.params.paperId, "paperId"))))
);

router.get("/:id/questions", wrap(async (req, res) => success(res, await questionBankService.list(req.user!.userId, courseId(req), questionBankQuerySchema.parse(req.query)))));

router.get("/:id/rubrics", wrap(async (req, res) => success(res, await rubricService.listForCourse(req.user!.userId, courseId(req)))));

router.get("/:id/lecture-plans", wrap(async (req, res) => success(res, await lecturePlanService.list(req.user!.userId, courseId(req)))));
router.post("/:id/lecture-plans", wrap(async (req, res) => success(res, await lecturePlanService.generate(req.user!.userId, courseId(req), lecturePlanSchema.parse(req.body)), 201)));
router.delete(
  "/:id/lecture-plans/:planId",
  wrap(async (req, res) => success(res, await lecturePlanService.remove(req.user!.userId, courseId(req), parsePositiveId(req.params.planId, "planId"))))
);

router.get("/:id/material-gaps", wrap(async (req, res) => success(res, await materialGapService.analyze(req.user!.userId, courseId(req)))));

router.get(
  "/:id/course-file.zip",
  wrap(async (req, res) => {
    const { buffer, filename } = await courseFileService.build(req.user!.userId, courseId(req));
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.status(200).end(buffer);
  })
);

router.get("/:id", courseController.getById);
router.post("/", courseController.create);

export default router;
