import { userRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../utils/hash";
import { signToken } from "../utils/jwt";
import { AppError } from "../middleware/error.middleware";
import { RegisterInput, LoginInput } from "../validators/auth.validator";

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
};
