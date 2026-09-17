import { currentAiSelection, PublicAiModel } from "./modelContext";
import { resolveAiModel } from "./providers";

export function resolveChatSelection(options: { model?: string; allowFallback?: boolean } = {}) {
  const scope = currentAiSelection();
  const requested = options.model ?? (scope?.modelId === "auto" ? undefined : scope?.modelId);
  return {
    target: resolveAiModel(requested),
    allowFallback: options.allowFallback ?? (options.model ? false : scope?.allowFallback ?? true),
  };
}

export function publicAiModel(target: ReturnType<typeof resolveAiModel>): PublicAiModel {
  return { id: target.id, provider: target.provider.id, providerLabel: target.provider.label, model: target.model, label: `${target.provider.label} / ${target.model}` };
}
