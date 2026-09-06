import { api } from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
  department?: string;
  designation?: string;
}

export const authService = {
  login: (payload: LoginPayload) => api.post("/auth/login", payload).then((r) => r.data.data),
  register: (payload: RegisterPayload) => api.post("/auth/register", payload).then((r) => r.data.data),
};
