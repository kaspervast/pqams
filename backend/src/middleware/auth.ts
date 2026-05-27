import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../lib/http.js";

type AccessPayload = { sub: string; type: "access" };

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Authentication required");
  let payload: AccessPayload;
  try {
    payload = jwt.verify(header.slice(7), config.JWT_SECRET) as AccessPayload;
  } catch {
    throw new ApiError(401, "Access token is invalid or expired");
  }
  if (payload.type !== "access") throw new ApiError(401, "Invalid token");
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user?.isActive) throw new ApiError(401, "User account is inactive");
  req.auth = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    policeUnitId: user.policeUnitId,
    mustChangePassword: user.mustChangePassword
  };
  next();
});

export function allow(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(new ApiError(403, "Not authorized for this operation"));
    next();
  };
}

export const requireChangedPassword: RequestHandler = (req, _res, next) => {
  if (req.auth?.mustChangePassword) return next(new ApiError(403, "Password change is required before continuing"));
  next();
};

