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

function unitInterval(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const jwtSecret = required("JWT_SECRET", nodeEnv === "production" ? undefined : "dev_secret_change_me");
if (nodeEnv === "production" && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters in production");
}

const groqApiKey = process.env.GROQ_API_KEY;
const openAiApiKey = groqApiKey || process.env.OPENAI_API_KEY || "";
const isGroq = Boolean(groqApiKey) || openAiApiKey.startsWith("gsk_");

const openAiBaseUrl =
  process.env.OPENAI_BASE_URL ??
  (isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions");
// Same provider, different endpoint — derived so a self-hosted OpenAI-compatible
// server only needs OPENAI_BASE_URL set, not a second variable.
const speechBaseUrl = process.env.SPEECH_BASE_URL ?? openAiBaseUrl.replace(/\/chat\/completions\/?$/, "/audio/transcriptions");

export const env = {
  nodeEnv,
  port: positiveInteger("PORT", 5000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  groqApiKey: groqApiKey ?? "",
  /** Externally reachable API origin for links in emails and calendar feeds. */
  apiPublicUrl: (process.env.API_PUBLIC_URL ?? `http://localhost:${positiveInteger("PORT", 5000)}`).replace(/\/$/, ""),
  openAiApiKey,
  openAiBaseUrl,
  openAiModel: process.env.OPENAI_MODEL ?? (isGroq ? "openai/gpt-oss-120b" : "gpt-4o-mini"),
  // Second, different-vendor model for the Dual Evaluator so its consensus is a real cross-check.
  dualEvalSecondaryModel: process.env.DUAL_EVAL_SECONDARY_MODEL ?? (isGroq ? "qwen/qwen3.8-27b" : "gpt-4o"),
  /** Image-capable model used to transcribe photographed routines. Empty string disables image import. */
  visionModel: process.env.VISION_MODEL ?? (isGroq ? "qwen/qwen3.8-27b" : "gpt-4o-mini"),
  /**
   * Speech-to-text model for the voice Copilot. Whisper is used rather than the
   * browser's Web Speech API because faculty here dictate in Bengali and
   * Bangla-accented English, which the browser engines transcribe poorly.
   * Empty string disables voice input.
   */
  speechModel: process.env.SPEECH_MODEL ?? (isGroq ? "whisper-large-v3-turbo" : "whisper-1"),
  speechBaseUrl,
  /** Upper bound on an uploaded voice clip. Whisper bills by audio length, and a
   * runaway recording is the only way this route can cost real money. */
  maxSpeechSeconds: positiveInteger("MAX_SPEECH_SECONDS", 120),
  aiTimeoutMs: positiveInteger("AI_TIMEOUT_MS", 45_000),
  maxAiInputChars: positiveInteger("MAX_AI_INPUT_CHARS", 80_000),
  /** Syllabus text is truncated to this many characters before entering any prompt (Groq free tier: ~8k tokens/request). */
  syllabusPromptChars: positiveInteger("SYLLABUS_PROMPT_CHARS", isGroq ? 9_000 : 30_000),
  isGroq,
  embedding: {
    enabled: process.env.EMBEDDING_ENABLED !== "false",
    model: process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2",
    modelDir: process.env.EMBEDDING_MODEL_DIR ?? "models",
    // Production images bake the model; refuse network fetches there so "offline" is enforced.
    allowRemote: process.env.EMBEDDING_ALLOW_REMOTE
      ? process.env.EMBEDDING_ALLOW_REMOTE !== "false"
      : nodeEnv !== "production",
    timeoutMs: positiveInteger("EMBEDDING_TIMEOUT_MS", 60_000),
    similarityFloor: unitInterval("EMBEDDING_SIMILARITY_FLOOR", 0.55),
    nearDuplicate: unitInterval("EMBEDDING_NEAR_DUPLICATE", 0.9),
    topK: positiveInteger("EMBEDDING_TOP_K", 5),
    maxCandidatePairs: positiveInteger("EMBEDDING_MAX_CANDIDATE_PAIRS", 40),
  },
  reliability: {
    /** Samples per analysis when a caller asks for `reliability: "verified"`. */
    sampleCount: positiveInteger("RELIABILITY_SAMPLE_COUNT", 3),
    /** Sampling temperature. 0.2 would make samples near-identical and fake high agreement. */
    sampleTemperature: unitInterval("RELIABILITY_SAMPLE_TEMPERATURE", 0.6),
    /** Process-wide cap on in-flight LLM calls, shared by sampling and fullAnalysis. */
    maxConcurrentLlmCalls: positiveInteger("LLM_MAX_CONCURRENT", 2),
    cacheEnabled: process.env.LLM_CACHE_ENABLED !== "false",
    cacheTtlDays: positiveInteger("LLM_CACHE_TTL_DAYS", 30),
    traceRetentionDays: positiveInteger("TRACE_RETENTION_DAYS", 90),
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    textModel: process.env.OLLAMA_TEXT_MODEL ?? "gemma3:4b",
    visionModel: process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:3b",
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
    timeoutMs: positiveInteger("OLLAMA_TIMEOUT_MS", 120_000),
  },
};
