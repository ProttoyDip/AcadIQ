import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { runInRequestScope } from "../ai/trace";
import { runWithAiSelection } from "../ai/modelContext";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : randomUUID();
  res.setHeader("x-request-id", requestId);
  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  // `?noCache=true` bypasses LLM cache reads for this request (still writes).
  runInRequestScope(requestId, req.query.noCache === "true", () =>
    runWithAiSelection({ modelId: req.get("x-ai-model"), allowFallback: req.get("x-ai-fallback") === "true" }, () => next())
  );
}
