import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { failure } from "../utils/apiResponse";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";

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

  if (err instanceof ZodError) {
    return failure(res, "Request validation failed", 422, err.flatten());
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "PDF exceeds the 10 MB limit" : err.message;
    return failure(res, message, 400);
  }

  if (err instanceof Error && err.message === "Only PDF files are allowed") {
    return failure(res, err.message, 400);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return failure(res, "A record with these values already exists", 409);
    if (err.code === "P2003") return failure(res, "Referenced record does not exist", 409);
  }

  logger.error("unhandled_error", {
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? err.message : String(err),
  });
  return failure(res, "Internal server error", 500);
}
