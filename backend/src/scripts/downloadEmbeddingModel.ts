import path from "node:path";

/**
 * Pre-fetches the embedding model into EMBEDDING_MODEL_DIR so production images
 * can run fully offline (EMBEDDING_ALLOW_REMOTE=false). Run at image build time,
 * so it reads process.env directly rather than the app config (no DATABASE_URL yet).
 */
async function main() {
  const model = process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";
  const modelDir = path.resolve(process.cwd(), process.env.EMBEDDING_MODEL_DIR ?? "models");
  const transformers = await import("@huggingface/transformers");
  transformers.env.localModelPath = modelDir;
  transformers.env.cacheDir = modelDir;
  transformers.env.allowRemoteModels = true;
  const started = Date.now();
  await transformers.pipeline("feature-extraction", model, { dtype: "q8" });
  console.log(JSON.stringify({ model, modelDir, ms: Date.now() - started }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
