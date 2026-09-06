import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { useLogin } from "../hooks/useAuthMutations";
import { apiErrorMessage } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate("/dashboard");
    } catch {
      // surfaced via login.error below
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h2 className="text-heading font-bold tracking-tight text-foreground">Welcome back</h2>
      <p className="mt-1 text-small text-muted-foreground">Sign in to your AcadIQ faculty account.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        {login.isError && (
          <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
            {apiErrorMessage(login.error, "Login failed")}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="faculty@university.edu"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={login.isPending} className="mt-2 w-full">
          <LogIn className="h-4 w-4" />
          {login.isPending ? "Signing in..." : "Sign in"}
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
