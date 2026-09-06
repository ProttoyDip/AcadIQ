import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-lg font-semibold text-brand-700">AcadIQ</div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">{user?.name}</span>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
