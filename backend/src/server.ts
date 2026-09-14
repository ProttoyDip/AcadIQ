import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./database/prismaClient";
import { embeddingService } from "./ai/embedding/embeddingService";

const server = app.listen(env.port, () => {
  logger.info("server_started", { port: env.port, environment: env.nodeEnv });
  // Fire-and-forget so the first similarity request does not pay the model cold start.
  if (embeddingService.available) embeddingService.warmUp().catch(() => undefined);
});

async function shutdown(signal: string, code = 0) {
  logger.info("server_shutdown_started", { signal });
  server.close(async () => {
    await embeddingService.shutdown();
    await prisma.$disconnect();
    process.exit(code);
  });
  setTimeout(() => process.exit(code || 1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Without these a crash leaves nothing behind: Node prints to stderr and exits,
// so an operator reading the structured log sees a normal request and then
// silence. Every exit path below names itself first.
server.on("error", (error: NodeJS.ErrnoException) => {
  logger.error("server_listen_failed", { code: error.code, reason: error.message });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("uncaught_exception", { reason: error.stack ?? error.message });
  void shutdown("uncaughtException", 1);
});

// NOTE: registering this handler suppresses Node's default
// --unhandled-rejections=throw, which would otherwise kill the process. That is
// the right trade for a server, but it converts a hard crash into a log line —
// so treat `unhandled_rejection` entries as real bugs, not noise.
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { reason: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason) });
});

// Fires when the loop empties with no explicit exit — the one death no other hook sees.
process.on("beforeExit", (code) => logger.info("process_before_exit", { code }));
// Synchronous only: logger.info is a plain console.log, so this is safe here.
process.on("exit", (code) => logger.info("process_exit", { code }));
