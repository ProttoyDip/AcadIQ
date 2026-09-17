export interface AiModel {
  id: string;
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
}

export interface AiModelCatalog {
  defaultModelId: string | null;
  /** Chat/JSON models, the only ones the picker may offer. */
  models: AiModel[];
  /** Image-capable models, kept separate: they are not usable for chat. */
  visionModels: AiModel[];
}

export interface AiResponseMetadata {
  requestedModel: string;
  fallbackUsed: boolean;
  usedModels: AiModel[];
}
