import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const jwtSecret = required("JWT_SECRET", nodeEnv === "production" ? undefined : "dev_secret_change_me");
if (nodeEnv === "production" && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters in production");
}

export const env = {
  nodeEnv,
  port: positiveInteger("PORT", 5000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  aiTimeoutMs: positiveInteger("AI_TIMEOUT_MS", 45_000),
  maxAiInputChars: positiveInteger("MAX_AI_INPUT_CHARS", 80_000),
};
