import crypto from "crypto";
import { userRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../utils/hash";
import { signToken } from "../utils/jwt";
import { sendPasswordResetEmail } from "../utils/mailer";
import { AppError } from "../middleware/error.middleware";
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from "../validators/auth.validator";

export const authService = {
  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError("An account with this email already exists", 409);
    }

    const hashed = await hashPassword(input.password);
    // Public registration is deliberately faculty-only. Admins must be provisioned out of band.
    const role = "FACULTY" as const;
    const user = await userRepository.createWithFacultyProfile({
      name: input.name,
      email: input.email,
      password: hashed,
      role,
      department: input.department,
      designation: input.designation,
    });

    const token = signToken({ userId: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = signToken({ userId: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  },

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await userRepository.findByEmail(input.email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await userRepository.createResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (err) {
        console.error("Failed to send password reset email via SMTP:", err);
      }
    }

    return { message: "If an account exists for this email, a password reset link has been sent." };
  },

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
    const tokenRecord = await userRepository.findResetToken(tokenHash);

    if (!tokenRecord) {
      throw new AppError("Invalid or expired password reset token", 400);
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError("Password reset token has expired. Please request a new one.", 400);
    }

    const newHashedPassword = await hashPassword(input.newPassword);
    await userRepository.updatePassword(tokenRecord.userId, newHashedPassword);
    await userRepository.markTokenUsed(tokenRecord.id);

    return { message: "Your password has been successfully reset. You can now log in with your new password." };
  },
};
