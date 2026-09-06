import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
  role: z.literal("FACULTY").optional(),
  department: z.string().trim().max(120).transform((value) => value || "Not specified").default("Not specified"),
  designation: z.string().trim().max(120).transform((value) => value || "Not specified").default("Not specified"),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
