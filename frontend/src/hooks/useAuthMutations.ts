import { useMutation } from "@tanstack/react-query";
import { authService, LoginPayload, RegisterPayload } from "../services/authService";
import { useAuthStore } from "../store/authStore";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: ({ token, user }) => setAuth(token, user),
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: ({ token, user }) => setAuth(token, user),
  });
}
