import { AsyncLocalStorage } from "node:async_hooks";

export interface PublicAiModel {
  id: string;
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
}

interface AiSelection {
  modelId: string;
  allowFallback: boolean;
  usedModels: PublicAiModel[];
  fallbackUsed: boolean;
}

const storage = new AsyncLocalStorage<AiSelection>();

export function runWithAiSelection<T>(selection: { modelId?: string; allowFallback?: boolean }, fn: () => T): T {
  const modelId = selection.modelId || "auto";
  return storage.run({ modelId, allowFallback: modelId === "auto" || selection.allowFallback === true, usedModels: [], fallbackUsed: false }, fn);
}

export function currentAiSelection(): AiSelection | undefined { return storage.getStore(); }

export function recordAiModel(model: PublicAiModel, fallbackUsed = false) {
  const scope = storage.getStore();
  if (!scope) return;
  if (!scope.usedModels.some((used) => used.id === model.id)) scope.usedModels.push(model);
  scope.fallbackUsed ||= fallbackUsed;
}

export function aiResponseMetadata() {
  const scope = storage.getStore();
  if (!scope?.usedModels.length) return undefined;
  return { requestedModel: scope.modelId, fallbackUsed: scope.fallbackUsed, usedModels: scope.usedModels };
}
