import { Router } from "express";
import { courseController } from "../controllers/course.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);
router.get("/", courseController.list);
router.get("/:id", courseController.getById);
router.post("/", requireRole("FACULTY", "ADMIN"), courseController.create);

export default router;
