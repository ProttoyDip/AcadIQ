import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { authService } from "../services/authService";
import { apiErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

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
    } catch (err) {
      setError(apiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h2 className="text-heading font-bold tracking-tight text-foreground">Create your account</h2>
      <p className="mt-1 text-small text-muted-foreground">Set up faculty access to AcadIQ.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Dr. Jane Rahman" required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-email">Email</Label>
          <Input id="reg-email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-password">Password</Label>
          <Input id="reg-password" type="password" placeholder="Min. 8 characters" required value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Department</Label>
            <Input id="department" placeholder="CSE" value={form.department} onChange={(e) => update("department", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" placeholder="Assistant Professor" value={form.designation} onChange={(e) => update("designation", e.target.value)} />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          <UserPlus className="h-4 w-4" />
          {loading ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-center text-small text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </motion.div>
  );
}
