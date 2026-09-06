import { create } from "zustand";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "FACULTY";
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("acadiq_token"),
  user: JSON.parse(localStorage.getItem("acadiq_user") ?? "null"),
  setAuth: (token, user) => {
    localStorage.setItem("acadiq_token", token);
    localStorage.setItem("acadiq_user", JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("acadiq_token");
    localStorage.removeItem("acadiq_user");
    set({ token: null, user: null });
  },
}));
