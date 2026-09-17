import { useId } from "react";
import { useAiModels } from "../../hooks/useAiModels";
import { useAiPreferencesStore } from "../../store/aiPreferencesStore";
import { apiErrorMessage } from "../../services/api";
import { cn } from "../../lib/utils";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

interface AiModelSelectorProps {
  compact?: boolean;
  disabled?: boolean;
}

export default function AiModelSelector({ compact = false, disabled = false }: AiModelSelectorProps) {
  const id = useId();
  const catalog = useAiModels();
  const { modelId, allowFallback, lastResponse, setModel, setAllowFallback } = useAiPreferencesStore();
  const models = catalog.data?.models ?? [];
  const selectedModel = models.find((model) => model.id === modelId);
  const defaultModel = models.find((model) => model.id === catalog.data?.defaultModelId);
  const unavailableSelection = modelId !== "auto" && Boolean(catalog.data) && !selectedModel;
  const auto = modelId === "auto";
  const empty = Boolean(catalog.data) && models.length === 0;

  return (
    <div className={cn("min-w-0 space-y-2", !compact && "max-w-2xl")}>
      <div className={cn("flex gap-2", compact ? "items-center" : "flex-col")}>
        <Label htmlFor={id} className={cn("shrink-0", compact && "text-xs")}>AI model</Label>
        <select
          id={id}
          value={modelId}
          onChange={(event) => setModel(event.target.value)}
          disabled={disabled || !catalog.data || empty}
          aria-describedby={`${id}-help`}
          className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-small text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="auto">{catalog.isPending ? "Loading models..." : "Auto (recommended)"}</option>
          {modelId !== "auto" && !selectedModel && <option value={modelId}>{modelId} (unavailable)</option>}
          {models.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.providerLabel}</option>)}
        </select>
      </div>

      <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">
        {catalog.isPending
          ? "Loading available models."
          : catalog.isError && !catalog.data
            ? apiErrorMessage(catalog.error, "Could not load available models.")
            : empty
              ? "No AI models are configured. Ask your administrator to add a provider."
              : auto
                ? compact
                  ? "Auto uses a backup if credits, rate limits or an outage block a model."
                  : `Auto starts with ${defaultModel ? `${defaultModel.label} (${defaultModel.providerLabel})` : "the default model"} and tries a configured backup if credits, rate limits or a temporary outage block the request.`
                : "Uses your chosen model. Enable a backup below to allow switching if it is unavailable."}
      </p>

      {catalog.isError && (
        <Button type="button" variant="outline" size="sm" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>
          {catalog.isFetching ? "Retrying..." : "Retry loading models"}
        </Button>
      )}

      {!auto && (
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={allowFallback}
            onChange={(event) => setAllowFallback(event.target.checked)}
            disabled={disabled || !catalog.data || empty}
            className="h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
          />
          Use another model if unavailable
        </label>
      )}

      {unavailableSelection && (
        <p role="status" className="text-xs text-warning">Your saved model is no longer configured. Choose Auto or an available model.</p>
      )}

      <p className="break-words text-xs leading-relaxed text-muted-foreground" aria-live="polite" aria-atomic="true">
        <span className="font-medium text-foreground">Last AI response in AcadIQ: </span>
        {lastResponse
          ? <>{lastResponse.usedModels.map((model) => `${model.label} (${model.providerLabel})`).join(", ")}{lastResponse.fallbackUsed && <span className="font-medium text-foreground"> · Backup used</span>}</>
          : "No response yet this session."}
      </p>

      {!compact && <p className="text-xs text-muted-foreground">Applies to Copilot and cloud AI text tasks for your account on this browser. Local AI tools, image reading, voice and search use their own models.</p>}
    </div>
  );
}
