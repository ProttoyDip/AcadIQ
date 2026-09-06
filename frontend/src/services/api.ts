import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

/**
 * Extracts a human-readable message from an API error. Falls back to the
 * first Zod field error when the backend returns a 422 validation failure
 * (`error.details.fieldErrors`), since "Request validation failed" alone
 * isn't actionable for the person filling out the form.
 */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  const err = error as any;

  if (!err?.response) {
    return "Could not reach the server. Check your connection and try again.";
  }

  const apiError = err.response.data?.error;
  const fieldErrors = apiError?.details?.fieldErrors as Record<string, string[]> | undefined;
  if (fieldErrors) {
    const firstField = Object.keys(fieldErrors).find((key) => fieldErrors[key]?.length);
    if (firstField) return fieldErrors[firstField][0];
  }

  return apiError?.message ?? fallback;
}
