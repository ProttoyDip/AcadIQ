import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { useResetPassword } from "../hooks/useAuthMutations";
import { apiErrorMessage } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetPassword = useResetPassword();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!token) {
      setValidationError("Missing password reset token in URL. Please use the link provided in your email.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }

    try {
      await resetPassword.mutateAsync({ token, newPassword });
      setIsSuccess(true);
    } catch {
      // Error surfaced via resetPassword.error
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h2 className="text-heading font-bold tracking-tight text-foreground">Set new password</h2>
      <p className="mt-1 text-small text-muted-foreground">
        Choose a strong new password for your AcadIQ faculty account.
      </p>

      {isSuccess ? (
        <div className="mt-8 rounded-lg border border-success-border bg-success-bg p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">Password Reset Complete</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Your password has been successfully updated. You can now log in using your new credentials.
          </p>
          <div className="mt-6">
            <Link to="/login">
              <Button className="w-full">
                Sign In to Your Account
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {(validationError || resetPassword.isError) && (
            <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
              {validationError || apiErrorMessage(resetPassword.error, "Password reset failed")}
            </div>
          )}

          {!token && (
            <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning font-medium">
              Warning: No reset token found in URL. Please click the link inside the password reset email.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Min. 10 characters"
              minLength={10}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              At least 10 characters, with an uppercase letter, a lowercase letter, and a number.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter new password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={resetPassword.isPending || !token} className="mt-2 w-full">
            <Lock className="h-4 w-4" />
            {resetPassword.isPending ? "Updating password..." : "Reset Password"}
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
