import { api } from "./api";
import { AuthUser } from "../store/authStore";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
  department?: string;
  designation?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authService = {
  login: (payload: LoginPayload) => api.post<{ data: AuthResponse }>("/auth/login", payload).then((r) => r.data.data),
  register: (payload: RegisterPayload) =>
    api.post<{ data: AuthResponse }>("/auth/register", payload).then((r) => r.data.data),
};
