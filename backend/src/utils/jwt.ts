import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: number;
  role: "ADMIN" | "FACULTY";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: "acadiq-api",
    audience: "acadiq-web",
    algorithm: "HS256",
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret, {
    issuer: "acadiq-api",
    audience: "acadiq-web",
    algorithms: ["HS256"],
  });
  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "number" ||
    (decoded.role !== "ADMIN" && decoded.role !== "FACULTY")
  ) {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId, role: decoded.role };
}
