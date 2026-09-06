import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { authService } from "../services/authService";
import { apiErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await authService.login({ email, password });
      setAuth(token, user);
      navigate("/dashboard");
    } catch (err) {
      setError(apiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h2 className="text-heading font-bold tracking-tight text-foreground">Welcome back</h2>
      <p className="mt-1 text-small text-muted-foreground">Sign in to your AcadIQ faculty account.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="jane.rahman@aust.edu"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          <LogIn className="h-4 w-4" />
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        <p className="text-center text-small text-muted-foreground">
          No account?{" "}
          <Link to="/register" className="font-medium text-primary-700 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </motion.div>
  );
}
