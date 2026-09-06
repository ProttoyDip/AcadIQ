import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "", designation: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await authService.register(form);
      setAuth(token, user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-900">Faculty registration</h2>
      {error && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-600">{error}</p>}
      <input placeholder="Full name" required value={form.name} onChange={(e) => update("name", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input type="email" placeholder="Email" required value={form.email} onChange={(e) => update("email", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input type="password" placeholder="Password (min 8 chars)" required value={form.password} onChange={(e) => update("password", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input placeholder="Department" value={form.department} onChange={(e) => update("department", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input placeholder="Designation" value={form.designation} onChange={(e) => update("designation", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <button type="submit" disabled={loading} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
