import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { failure } from "../utils/apiResponse";

export function requireRole(...roles: Array<"ADMIN" | "FACULTY">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return failure(res, "Insufficient permissions", 403);
    }
    next();
  };
}
