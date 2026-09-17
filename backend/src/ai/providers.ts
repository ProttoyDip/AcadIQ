import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";

/** Server-only configuration. Never serialize providers into an API response. */
export interface AiProvider {
  id: string;
  label: string;
  /** Full chat completions endpoint, including /chat/completions. */
  baseUrl: string;
  apiKey: string;
  /** False uses prompt-based JSON plus local validation instead of response_format. */
  jsonMode: boolean;
  models: string[];
  defaultModel: string;
}

export interface AiModel {
  id: string;
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
}

export interface ResolvedAiModel {
  provider: AiProvider;
  model: string;
  id: string;
}

const modelName = z.string().trim().min(1).max(200).refine((value) => !/\s/.test(value));
const providerDefinition = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/).refine((id) => id !== "default"),
  label: z.string().trim().min(1).max(80),
  baseUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      && !url.username && !url.password && !url.search && !url.hash;
  }),
  apiKeyEnv: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  jsonMode: z.boolean().default(true),
  models: z.array(modelName).min(1).max(64),
  defaultModel: modelName.optional(),
}).strict().refine((provider) => !provider.defaultModel || provider.models.includes(provider.defaultModel));

function extraProviders(): AiProvider[] {
  const raw = process.env.AI_PROVIDERS_JSON?.trim();
  if (!raw) return [];

  let definitions: z.infer<typeof providerDefinition>[];
  try {
    definitions = z.array(providerDefinition).max(10).parse(JSON.parse(raw));
    if (new Set(definitions.map((provider) => provider.id)).size !== definitions.length) {
      throw new Error("Duplicate provider IDs");
    }
  } catch {
    // Parse errors may embed raw input, including accidentally pasted secrets.
    throw new Error("AI_PROVIDERS_JSON is invalid. Check the provider configuration in docs/ai-providers.md.");
  }

  return definitions.flatMap((definition) => {
    const apiKey = process.env[definition.apiKeyEnv]?.trim();
    // Operators may preconfigure providers before supplying their credentials.
    if (!apiKey) return [];
    return [{
      id: definition.id,
      label: definition.label,
      baseUrl: definition.baseUrl.replace(/\/$/, ""),
      apiKey,
      jsonMode: definition.jsonMode,
      models: [...new Set(definition.models)],
      defaultModel: definition.defaultModel ?? definition.models[0],
    }];
  });
}

/** Legacy configuration remains first; additional providers follow JSON order. */
export function getAiProviders(): AiProvider[] {
  const providers: AiProvider[] = [];
  if (env.openAiApiKey) {
    if (!env.openAiModel.trim()) throw new Error("OPENAI_MODEL must not be empty when the default AI provider is configured.");
    const label = env.isGroq
      ? "Groq"
      : /^https:\/\/api\.openai\.com\//.test(env.openAiBaseUrl) ? "OpenAI" : "Default provider";
    providers.push({
      id: "default",
      label,
      baseUrl: env.openAiBaseUrl,
      apiKey: env.openAiApiKey,
      jsonMode: true,
      models: [...new Set([env.openAiModel, env.dualEvalSecondaryModel].filter(Boolean))],
      defaultModel: env.openAiModel,
    });
  }
  return [...providers, ...extraProviders()];
}

/** Safe, allowlisted public metadata: no credentials or endpoints. */
export function getModelCatalog(): { defaultModelId: string | null; models: AiModel[] } {
  const providers = getAiProviders();
  return {
    defaultModelId: providers.length ? `${providers[0].id}:${providers[0].defaultModel}` : null,
    models: providers.flatMap((provider) => provider.models.map((model) => ({
      id: `${provider.id}:${model}`,
      provider: provider.id,
      providerLabel: provider.label,
      model,
      label: `${provider.label} / ${model}`,
    }))),
  };
}

/** Accept public IDs or existing internal raw model names, always from the allowlist. */
export function resolveAiModel(idOrModel?: string): ResolvedAiModel {
  const providers = getAiProviders();
  if (!providers.length) throw new AppError("No AI provider is configured on this server", 503);
  if (idOrModel === undefined) {
    const provider = providers[0];
    return { provider, model: provider.defaultModel, id: `${provider.id}:${provider.defaultModel}` };
  }
  for (const provider of providers) {
    const model = provider.models.find((candidate) => `${provider.id}:${candidate}` === idOrModel);
    if (model) return { provider, model, id: `${provider.id}:${model}` };
  }
  for (const provider of providers) {
    if (provider.models.includes(idOrModel)) {
      return { provider, model: idOrModel, id: `${provider.id}:${idOrModel}` };
    }
  }
  throw new AppError("The selected AI model is not available on this server", 400);
}
