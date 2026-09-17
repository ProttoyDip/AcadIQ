import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useAiPreferencesStore } from "../store/aiPreferencesStore";
import type { AiResponseMetadata } from "../types/ai";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    aiRequestUserId?: number;
    aiRequestToken?: string;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const { token, user } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.aiRequestUserId = user?.id;
    config.aiRequestToken = token;
    const { modelId, allowFallback } = useAiPreferencesStore.getState();
    config.headers["X-AI-Model"] = modelId;
    config.headers["X-AI-Fallback"] = String(modelId === "auto" || allowFallback);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const { token, user } = useAuthStore.getState();
    const metadata = response.data?.ai as AiResponseMetadata | undefined;
    // A late response from a previous login must not appear in this account.
    if (metadata && Array.isArray(metadata.usedModels) && user &&
      response.config.aiRequestUserId === user.id && response.config.aiRequestToken === token) {
      useAiPreferencesStore.getState().recordResponse(user.id, metadata);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

/** "courseId" -> "Course", "questionText" -> "Question text". */
function fieldLabel(field: string): string {
  const words = field.replace(/Id$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Extracts a human-readable message from an API error. Falls back to the
 * first Zod field error when the backend returns a 422 validation failure
 * (`error.details.fieldErrors`), since "Request validation failed" alone
 * isn't actionable for the person filling out the form.
 *
 * The fieldErrors fallback is deliberately limited to 422. Other statuses can
 * carry Zod details that describe something other than the user's input — a
 * 502 from the Copilot, for instance, carries the schema errors from the
 * *model's* reply — and there the written message explains the situation while
 * a bare field error ("Required") tells the user nothing they can act on.
 */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  const err = error as any;

  if (!err?.response) {
    return "Could not reach the server. Check your connection and try again.";
  }

  const apiError = err.response.data?.error;

  if (err.response.status === 422) {
    const fieldErrors = apiError?.details?.fieldErrors as Record<string, string[]> | undefined;
    if (fieldErrors) {
      const firstField = Object.keys(fieldErrors).find((key) => fieldErrors[key]?.length);
      if (firstField) return `${fieldLabel(firstField)}: ${fieldErrors[firstField][0]}`;
    }
  }

  return apiError?.message ?? fallback;
}
