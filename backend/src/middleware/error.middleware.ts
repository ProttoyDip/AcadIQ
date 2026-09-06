import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { failure } from "../utils/apiResponse";

export class AppError extends Error {
  constructor(public message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  return failure(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return failure(res, err.message, err.status, err.details);
  }

  logger.error("Unhandled error", err);
  return failure(res, "Internal server error", 500);
}
