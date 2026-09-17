export interface AiModel {
  id: string;
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
}

export interface AiModelCatalog {
  defaultModelId: string | null;
  models: AiModel[];
}

export interface AiResponseMetadata {
  requestedModel: string;
  fallbackUsed: boolean;
  usedModels: AiModel[];
}
