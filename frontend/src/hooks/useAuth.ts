import { useAuthStore } from "../store/authStore";

export function useAuth() {
  const { token, user, setAuth, logout } = useAuthStore();
  return { token, user, isAuthenticated: !!token, setAuth, logout };
}
