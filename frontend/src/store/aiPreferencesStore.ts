import { create } from "zustand";
import { useAuthStore } from "./authStore";
import type { AiResponseMetadata } from "../types/ai";

interface AiPreferences {
  modelId: string;
  allowFallback: boolean;
}

interface AiPreferencesState extends AiPreferences {
  userId: number | null;
  lastResponse: AiResponseMetadata | null;
  setModel: (modelId: string) => void;
  setAllowFallback: (allowFallback: boolean) => void;
  recordResponse: (userId: number, metadata: AiResponseMetadata) => void;
}

const defaults: AiPreferences = { modelId: "auto", allowFallback: false };
const storageKey = (userId: number) => `acadiq_ai_preferences_${userId}`;

function readPreferences(userId: number | null): AiPreferences {
  if (userId === null) return { ...defaults };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "null");
    if (!saved || typeof saved !== "object") return { ...defaults };
    const value = saved as Partial<AiPreferences>;
    return {
      modelId: typeof value.modelId === "string" && value.modelId.length > 0 ? value.modelId : "auto",
      allowFallback: value.allowFallback === true,
    };
  } catch {
    return { ...defaults };
  }
}

function savePreferences(userId: number | null, preferences: AiPreferences) {
  if (userId === null) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}

const initialUserId = useAuthStore.getState().user?.id ?? null;

export const useAiPreferencesStore = create<AiPreferencesState>((set, get) => ({
  userId: initialUserId,
  ...readPreferences(initialUserId),
  lastResponse: null,
  setModel: (modelId) => {
    // Choosing a specific model is strict until the user opts into a backup.
    const preferences = { modelId, allowFallback: false };
    savePreferences(get().userId, preferences);
    set(preferences);
  },
  setAllowFallback: (allowFallback) => {
    const preferences = { modelId: get().modelId, allowFallback };
    savePreferences(get().userId, preferences);
    set(preferences);
  },
  recordResponse: (userId, metadata) => {
    if (get().userId === userId && metadata.usedModels.length > 0) {
      set({ lastResponse: metadata });
    }
  },
}));

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.token !== previous.token) {
    const userId = state.user?.id ?? null;
    useAiPreferencesStore.setState({ userId, ...readPreferences(userId), lastResponse: null });
  }
});
