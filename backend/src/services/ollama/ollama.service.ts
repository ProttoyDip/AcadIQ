import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";
import { logger } from "../../utils/logger";

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[]; // base64 encoded images
}

export interface OllamaChatOptions {
  model?: string;
  messages: OllamaChatMessage[];
  format?: "json" | string;
  temperature?: number;
  timeoutMs?: number;
}

export interface OllamaGenerateOptions {
  model?: string;
  prompt: string;
  system?: string;
  images?: string[];
  format?: "json" | string;
  temperature?: number;
  timeoutMs?: number;
}

export interface OllamaModelTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
}

export class OllamaService {
  public readonly baseUrl: string;
  public readonly defaultTextModel: string;
  public readonly defaultVisionModel: string;
  public readonly defaultEmbeddingModel: string;
  public readonly defaultTimeoutMs: number;

  constructor() {
    this.baseUrl = env.ollama.baseUrl.replace(/\/+$/, "");
    this.defaultTextModel = env.ollama.textModel;
    this.defaultVisionModel = env.ollama.visionModel;
    this.defaultEmbeddingModel = env.ollama.embeddingModel;
    this.defaultTimeoutMs = env.ollama.timeoutMs;
  }

  /**
   * Helper to execute fetch with timeout and handle connection/model errors gracefully.
   */
  private async fetchOllama(endpoint: string, options: RequestInit, timeoutMs = this.defaultTimeoutMs): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      return response;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new AppError(
          `Ollama request timed out after ${Math.round(timeoutMs / 1000)}s. The local model may be overloaded or initializing. Please retry.`,
          504
        );
      }
      if (error?.code === "ECONNREFUSED" || error?.cause?.code === "ECONNREFUSED" || error?.message?.includes("fetch failed")) {
        throw new AppError(
          `Cannot connect to Ollama at ${this.baseUrl}. Please ensure Ollama is installed and running ('ollama serve').`,
          503
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * List all models currently available in local Ollama.
   */
  async listModels(): Promise<OllamaModelTag[]> {
    try {
      const response = await this.fetchOllama("/api/tags", { method: "GET" }, 5000);
      if (!response.ok) {
        throw new AppError(`Failed to fetch Ollama models: HTTP ${response.status}`, response.status);
      }
      const data = (await response.json()) as { models?: OllamaModelTag[] };
      return data.models || [];
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.warn("ollama_list_models_failed", { error: error?.message });
      return [];
    }
  }

  /**
   * Check connection and model readiness.
   */
  async getStatus() {
    try {
      const models = await this.listModels();
      const modelNames = models.map((m) => m.name.toLowerCase());
      const required = [this.defaultTextModel, this.defaultVisionModel, this.defaultEmbeddingModel];
      
      const missing = required.filter(
        (req) => !modelNames.some((name) => name === req.toLowerCase() || name.startsWith(`${req.toLowerCase()}:`))
      );

      return {
        running: true,
        baseUrl: this.baseUrl,
        models: modelNames,
        config: {
          textModel: this.defaultTextModel,
          visionModel: this.defaultVisionModel,
          embeddingModel: this.defaultEmbeddingModel,
        },
        missingModels: missing,
      };
    } catch {
      return {
        running: false,
        baseUrl: this.baseUrl,
        models: [],
        config: {
          textModel: this.defaultTextModel,
          visionModel: this.defaultVisionModel,
          embeddingModel: this.defaultEmbeddingModel,
        },
        missingModels: [this.defaultTextModel, this.defaultVisionModel, this.defaultEmbeddingModel],
      };
    }
  }

  /**
   * Chat completion endpoint (/api/chat).
   */
  async chat(options: OllamaChatOptions): Promise<string> {
    const model = options.model || this.defaultTextModel;
    const body: Record<string, any> = {
      model,
      messages: options.messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
      },
    };

    if (options.format) {
      body.format = options.format;
    }

    const response = await this.fetchOllama("/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }, options.timeoutMs);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 404 || errText.includes("not found")) {
        throw new AppError(
          `Ollama model '${model}' is not installed. Please run 'ollama pull ${model}' in your terminal.`,
          404
        );
      }
      throw new AppError(`Ollama chat error (HTTP ${response.status}): ${errText || response.statusText}`, 502);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }

  /**
   * Text completion endpoint (/api/generate).
   */
  async generate(options: OllamaGenerateOptions): Promise<string> {
    const model = options.model || this.defaultTextModel;
    const body: Record<string, any> = {
      model,
      prompt: options.prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
      },
    };

    if (options.system) {
      body.system = options.system;
    }
    if (options.images && options.images.length > 0) {
      body.images = options.images;
    }
    if (options.format) {
      body.format = options.format;
    }

    const response = await this.fetchOllama("/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }, options.timeoutMs);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 404 || errText.includes("not found")) {
        throw new AppError(
          `Ollama model '${model}' is not installed. Please run 'ollama pull ${model}' in your terminal.`,
          404
        );
      }
      throw new AppError(`Ollama generate error (HTTP ${response.status}): ${errText || response.statusText}`, 502);
    }

    const data = (await response.json()) as { response?: string };
    return data.response ?? "";
  }

  /**
   * Embeddings endpoint (supporting both /api/embed and legacy /api/embeddings).
   */
  async getEmbedding(text: string, model = this.defaultEmbeddingModel): Promise<Float32Array> {
    // Try modern /api/embed first
    try {
      const response = await this.fetchOllama("/api/embed", {
        method: "POST",
        body: JSON.stringify({ model, input: text }),
      }, 30000);

      if (response.ok) {
        const data = (await response.json()) as { embeddings?: number[][] };
        if (data.embeddings && data.embeddings.length > 0) {
          return new Float32Array(data.embeddings[0]);
        }
      }
    } catch {
      // Fall back to /api/embeddings
    }

    const response = await this.fetchOllama("/api/embeddings", {
      method: "POST",
      body: JSON.stringify({ model, prompt: text }),
    }, 30000);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 404 || errText.includes("not found")) {
        throw new AppError(
          `Ollama embedding model '${model}' is not installed. Please run 'ollama pull ${model}' in your terminal.`,
          404
        );
      }
      throw new AppError(`Ollama embedding error (HTTP ${response.status}): ${errText || response.statusText}`, 502);
    }

    const data = (await response.json()) as { embedding?: number[] };
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new AppError("Failed to generate embedding: invalid response structure from Ollama", 502);
    }

    return new Float32Array(data.embedding);
  }
}

export const ollamaService = new OllamaService();
