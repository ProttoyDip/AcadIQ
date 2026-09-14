import path from "node:path";
import { Worker } from "node:worker_threads";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { prisma } from "../../database/prismaClient";
import { embeddingRepository, EmbeddingOwnerType, StoredVector } from "../../repositories/embedding.repository";
import { contentHash, normalizeForEmbedding } from "./vectorMath";

const BATCH_SIZE = 32;

export interface EmbeddingRef {
  ownerType: EmbeddingOwnerType;
  ownerId: number;
  courseId: number | null;
}

interface PendingJob {
  resolve: (vectors: Float32Array[]) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  count: number;
}

class EmbeddingService {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readonly pending = new Map<number, PendingJob>();
  private nextJobId = 1;
  private disabledReason: string | null = env.embedding.enabled ? null : "EMBEDDING_ENABLED=false";

  readonly model = env.embedding.model;

  get available(): boolean {
    return this.disabledReason === null;
  }

  get unavailableReason(): string | null {
    return this.disabledReason;
  }

  /** Spawns the worker and loads the model; safe to call repeatedly. */
  warmUp(): Promise<void> {
    if (this.disabledReason) return Promise.reject(new Error(this.disabledReason));
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const isTypeScript = __filename.endsWith(".ts");
      const workerPath = path.join(__dirname, `embedder.worker${isTypeScript ? ".ts" : ".js"}`);
      const worker = new Worker(workerPath, {
        workerData: { model: env.embedding.model, modelDir: env.embedding.modelDir, allowRemote: env.embedding.allowRemote },
        execArgv: isTypeScript ? ["-r", "ts-node/register/transpile-only"] : [],
      });
      this.worker = worker;
      const started = Date.now();
      const bootTimer = setTimeout(() => {
        reject(new Error(`Embedding model did not load within ${env.embedding.timeoutMs}ms`));
      }, env.embedding.timeoutMs);

      worker.on("message", (message: { type: string; id?: number; dimension?: number; buffer?: ArrayBuffer; error?: string }) => {
        if (message.type === "ready") {
          clearTimeout(bootTimer);
          logger.info("embedding_model_ready", { model: env.embedding.model, loadMs: Date.now() - started });
          resolve();
          return;
        }
        if (message.type === "fatal") {
          clearTimeout(bootTimer);
          reject(new Error(message.error ?? "embedding worker failed to start"));
          return;
        }
        if (message.id === undefined) return;
        const job = this.pending.get(message.id);
        if (!job) return;
        this.pending.delete(message.id);
        clearTimeout(job.timer);
        if (message.type === "error" || !message.buffer || !message.dimension) {
          job.reject(new Error(message.error ?? "embedding failed"));
          return;
        }
        const flat = new Float32Array(message.buffer);
        const vectors: Float32Array[] = [];
        for (let i = 0; i < job.count; i += 1) {
          vectors.push(flat.slice(i * message.dimension, (i + 1) * message.dimension));
        }
        job.resolve(vectors);
      });

      worker.on("error", (error) => {
        clearTimeout(bootTimer);
        this.failAll(error);
        reject(error);
      });
      worker.on("exit", (code) => {
        this.failAll(new Error(`embedding worker exited with code ${code}`));
        this.worker = null;
        this.readyPromise = null;
      });
    }).catch((error: Error) => {
      // Missing musl binary, missing model files, etc. Degrade to the LLM-only path instead of crashing.
      this.disabledReason = error.message;
      logger.warn("embedding_unavailable", { reason: error.message });
      void this.worker?.terminate();
      this.worker = null;
      throw error;
    });
    return this.readyPromise;
  }

  private failAll(error: Error) {
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    this.pending.clear();
  }

  private embedBatch(texts: string[]): Promise<Float32Array[]> {
    return new Promise((resolve, reject) => {
      const id = this.nextJobId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`embedding batch timed out after ${env.embedding.timeoutMs}ms`));
      }, env.embedding.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, count: texts.length });
      this.worker!.postMessage({ id, texts });
    });
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!texts.length) return [];
    await this.warmUp();
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map(normalizeForEmbedding);
      out.push(...(await this.embedBatch(batch)));
    }
    return out;
  }

  /**
   * Embeds any of the given questions that have no stored vector yet and returns
   * everything requested. Lazy self-heal: makes the system eventually consistent
   * without a mandatory backfill.
   */
  async ensureIndexed(
    ownerType: EmbeddingOwnerType,
    items: Array<{ id: number; text: string; courseId: number | null }>
  ): Promise<Map<number, Float32Array>> {
    const ids = items.map((item) => item.id);
    const existing = await embeddingRepository.findByOwners(ownerType, ids, this.model);
    const byId = new Map<number, Float32Array>(existing.map((row) => [row.ownerId, row.vector]));
    const missing = items.filter((item) => !byId.has(item.id));

    if (missing.length) {
      const vectors = await this.embed(missing.map((item) => item.text));
      const vectorIds = await embeddingRepository.upsertMany(missing.map((item, index) => ({
        ownerType,
        ownerId: item.id,
        courseId: item.courseId,
        model: this.model,
        vector: vectors[index],
        contentHash: contentHash(normalizeForEmbedding(item.text)),
      })));
      if (ownerType === "QUESTION") await embeddingRepository.linkQuestionHistory(vectorIds, this.model);
      missing.forEach((item, index) => byId.set(item.id, vectors[index]));
      logger.info("embedding_indexed", { ownerType, count: missing.length });
    }
    return byId;
  }

  /** Indexes every question in a paper. Called after the upload transaction commits. */
  async indexPaper(paperId: number): Promise<number> {
    const paper = await prisma.questionPaper.findUnique({
      where: { id: paperId },
      select: { courseId: true, questions: { select: { id: true, questionText: true } } },
    });
    if (!paper) return 0;
    const indexed = await this.ensureIndexed(
      "QUESTION",
      paper.questions.map((question) => ({ id: question.id, text: question.questionText, courseId: paper.courseId }))
    );
    return indexed.size;
  }

  /**
   * Resolves vectors for a mixed list: items with a storage ref are indexed and
   * persisted, items without one (ad-hoc user input) are embedded transiently.
   * Returns vectors keyed by the caller's own key.
   */
  async resolveVectors(
    items: Array<{ key: number; text: string; ref?: EmbeddingRef }>
  ): Promise<Map<number, Float32Array>> {
    const result = new Map<number, Float32Array>();
    const byOwnerType = new Map<EmbeddingOwnerType, Array<{ key: number; text: string; ref: EmbeddingRef }>>();
    const transient: Array<{ key: number; text: string }> = [];
    for (const item of items) {
      if (!item.ref) {
        transient.push(item);
        continue;
      }
      const group = byOwnerType.get(item.ref.ownerType) ?? [];
      group.push({ key: item.key, text: item.text, ref: item.ref });
      byOwnerType.set(item.ref.ownerType, group);
    }
    for (const [ownerType, group] of byOwnerType) {
      const indexed = await this.ensureIndexed(
        ownerType,
        group.map((item) => ({ id: item.ref.ownerId, text: item.text, courseId: item.ref.courseId }))
      );
      for (const item of group) {
        const vector = indexed.get(item.ref.ownerId);
        if (vector) result.set(item.key, vector);
      }
    }
    if (transient.length) {
      const vectors = await this.embed(transient.map((item) => item.text));
      transient.forEach((item, index) => result.set(item.key, vectors[index]));
    }
    return result;
  }

  findCourseVectors(courseId: number): Promise<StoredVector[]> {
    return embeddingRepository.findByCourse("QUESTION", courseId, this.model);
  }

  async shutdown() {
    await this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
}

export const embeddingService = new EmbeddingService();
