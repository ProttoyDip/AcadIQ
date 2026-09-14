import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";

// ONNX inference is synchronous native code; this worker keeps it off the Express event loop.

interface WorkerConfig {
  model: string;
  modelDir: string;
  allowRemote: boolean;
}

interface EmbedRequest {
  id: number;
  texts: string[];
}

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>;

const config = workerData as WorkerConfig;

async function loadExtractor(): Promise<FeatureExtractor> {
  const transformers = await import("@huggingface/transformers");
  const modelDir = path.resolve(process.cwd(), config.modelDir);
  transformers.env.localModelPath = modelDir;
  transformers.env.cacheDir = modelDir;
  transformers.env.allowLocalModels = true;
  transformers.env.allowRemoteModels = config.allowRemote;
  const extractor = await transformers.pipeline("feature-extraction", config.model, { dtype: "q8" });
  return extractor as unknown as FeatureExtractor;
}

const ready = loadExtractor();

ready
  .then(() => parentPort?.postMessage({ type: "ready" }))
  .catch((error: unknown) => {
    parentPort?.postMessage({ type: "fatal", error: error instanceof Error ? error.message : String(error) });
  });

parentPort?.on("message", async (request: EmbedRequest) => {
  try {
    const extractor = await ready;
    const output = await extractor(request.texts, { pooling: "mean", normalize: true });
    const [rows, dimension] = output.dims;
    // Copy into a standalone buffer so it can be transferred without touching ORT memory.
    const vectors = new Float32Array(output.data.subarray(0, rows * dimension));
    parentPort?.postMessage({ type: "result", id: request.id, dimension, buffer: vectors.buffer }, [vectors.buffer]);
  } catch (error) {
    parentPort?.postMessage({
      type: "error",
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
