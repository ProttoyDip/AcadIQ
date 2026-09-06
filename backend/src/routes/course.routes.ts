import { Router } from "express";
import { courseController } from "../controllers/course.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate, requireRole("FACULTY"));
router.get("/", courseController.list);
router.get("/:id", courseController.getById);
router.post("/", courseController.create);

export default router;
