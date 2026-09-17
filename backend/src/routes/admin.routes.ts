import { Router, Response, NextFunction } from "express";
import { adminController } from "../controllers/admin.controller";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { uploadRoutine } from "../middleware/upload.middleware";
import { AppError } from "../middleware/error.middleware";
import { departmentImportSchema, departmentRoutineService } from "../services/schedule/departmentRoutine.service";
import { success } from "../utils/apiResponse";
import { parsePositiveId } from "../utils/parseId";

const router = Router();

// Guard entire admin route tree: must be authenticated and have ADMIN role
router.use(authenticate, requireRole("ADMIN"));

router.get("/users", adminController.listUsers);
router.patch("/users/:id/role", adminController.updateUserRole);
router.delete("/users/:id", adminController.deleteUser);
router.get("/audit-logs", adminController.getAuditLogs);

const wrap = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

// Department routine (rooms + sections for every teacher)
router.get("/department-routine", wrap(async (_req, res) => success(res, await departmentRoutineService.list())));
router.get("/department-routine/:id/slots", wrap(async (req, res) => success(res, await departmentRoutineService.slots(parsePositiveId(req.params.id)))));
router.post(
  "/department-routine",
  uploadRoutine.single("file"),
  wrap(async (req, res) => {
    if (!req.file) throw new AppError("Routine file is required", 400);
    return success(res, await departmentRoutineService.import(req.user!.userId, req.file, departmentImportSchema.parse(req.body ?? {})), 201);
  })
);
router.delete("/department-routine/:id", wrap(async (req, res) => success(res, await departmentRoutineService.remove(parsePositiveId(req.params.id)))));

export default router;

