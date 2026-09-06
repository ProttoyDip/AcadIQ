import { api } from "./api";

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "FACULTY";
  createdAt: string;
  facultyProfile?: { department: string; designation: string } | null;
}

export const adminService = {
  listUsers: () => api.get<{ data: ManagedUser[] }>("/admin/users").then((response) => response.data.data),
  updateRole: (userId: number, role: ManagedUser["role"]) =>
    api.patch<{ data: ManagedUser }>(`/admin/users/${userId}/role`, { role }).then((response) => response.data.data),
  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),
};
