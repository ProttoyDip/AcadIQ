import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

// Guard entire admin route tree: must be authenticated and have ADMIN role
router.use(authenticate, requireRole("ADMIN"));

router.get("/users", adminController.listUsers);
router.patch("/users/:id/role", adminController.updateUserRole);
router.delete("/users/:id", adminController.deleteUser);
router.get("/audit-logs", adminController.getAuditLogs);

export default router;

