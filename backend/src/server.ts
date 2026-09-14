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

async function shutdown(signal: string) {
  logger.info("server_shutdown_started", { signal });
  server.close(async () => {
    await embeddingService.shutdown();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
