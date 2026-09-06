import { NextFunction, Request, Response } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { failure } from "../utils/apiResponse";
import { prisma } from "../database/prismaClient";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return failure(res, "Authentication token missing", 401);
  }

  let tokenUser: JwtPayload;
  try {
    tokenUser = verifyToken(header.split(" ")[1]);
  } catch {
    return failure(res, "Invalid or expired token", 401);
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: tokenUser.userId },
      select: { role: true },
    });
    if (!currentUser) return failure(res, "Invalid or expired token", 401);
    req.user = { userId: tokenUser.userId, role: currentUser.role };
    next();
  } catch (error) {
    next(error);
  }
}
