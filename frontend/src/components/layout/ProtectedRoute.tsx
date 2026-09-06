import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ProtectedRoute({ role }: { role?: "ADMIN" | "FACULTY" }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === "ADMIN" ? "/admin/users" : "/dashboard"} replace />;
  }
  return <Outlet />;
}
