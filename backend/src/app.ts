import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { apiRateLimiter } from "./middleware/rateLimiter.middleware";
import { requestContext } from "./middleware/requestContext.middleware";

const app = express();

app.use(helmet());
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestContext);
app.use(cors({ origin: env.frontendUrl.split(",").map((origin) => origin.trim()), credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
