import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { AiModelCatalog } from "../types/ai";

export function useAiModels() {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["ai", "models", userId],
    queryFn: async ({ signal }) => {
      const response = await api.get<{ success: true; data: AiModelCatalog }>("/ai/models", { signal });
      return response.data.data;
    },
    enabled: userId !== undefined,
    staleTime: 60_000,
  });
}
