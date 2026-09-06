import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useForgotPassword } from "../hooks/useAuthMutations";
import { apiErrorMessage } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const forgotPassword = useForgotPassword();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await forgotPassword.mutateAsync({ email });
      setIsSuccess(true);
    } catch {
      // Error message handled via forgotPassword.error
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Sign In
      </Link>

      <h2 className="text-heading font-bold tracking-tight text-foreground">Forgot password?</h2>
      <p className="mt-1 text-small text-muted-foreground">
        Enter your registered faculty email address and we'll send you a password reset link.
      </p>

      {isSuccess ? (
        <div className="mt-8 rounded-lg border border-success-border bg-success-bg p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">Check your inbox</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent a password reset link. Please check your inbox and spam folder.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="outline" onClick={() => setIsSuccess(false)} className="w-full text-xs">
              Try another email
            </Button>
            <Link to="/login" className="text-xs font-medium text-primary-700 hover:underline text-center">
              Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {forgotPassword.isError && (
            <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
              {apiErrorMessage(forgotPassword.error, "Failed to send password reset request")}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Faculty Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="faculty@university.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={forgotPassword.isPending} className="mt-2 w-full">
            <KeyRound className="h-4 w-4" />
            {forgotPassword.isPending ? "Sending reset link..." : "Send Reset Link"}
          </Button>

          <p className="text-center text-small text-muted-foreground">
            Remembered your password?{" "}
            <Link to="/login" className="font-medium text-primary-700 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </motion.div>
  );
}
