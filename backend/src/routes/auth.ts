import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { audit } from "../lib/activity.js";
import { ApiError, asyncHandler, ok } from "../lib/http.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10) });
const refreshCookie = "pqams_refresh";

function accessToken(userId: string) {
  return jwt.sign({ sub: userId, type: "access" }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });
}

function publicUser(user: {
  id: string; username: string; fullName: string; role: string; policeUnitId: string | null; mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    policeUnitId: user.policeUnitId,
    mustChangePassword: user.mustChangePassword
  };
}

async function setRefresh(res: Parameters<typeof ok>[0], userId: string) {
  const token = randomBytes(48).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + config.REFRESH_DAYS * 86400000);
  await prisma.refreshSession.create({ data: { userId, tokenHash, expiresAt } });
  res.cookie(refreshCookie, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.NODE_ENV === "production",
    expires: expiresAt,
    path: "/api/auth"
  });
}

router.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message: "Too many failed login attempts. Please try again after 15 minutes.",
        errors: []
      });
    }
  }),
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      await audit(req, { action: "LOGIN_FAILURE", entityType: "AUTH", newValue: { username: input.username } });
      throw new ApiError(401, "Invalid username or password");
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setRefresh(res, user.id);
    await audit(req, { action: "LOGIN_SUCCESS", entityType: "AUTH", userId: user.id, userRole: user.role });
    return ok(res, { accessToken: accessToken(user.id), user: publicUser(user) }, "Login successful");
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[refreshCookie] as string | undefined;
    if (!token) throw new ApiError(401, "Refresh session is required");
    const hash = createHash("sha256").update(token).digest("hex");
    const session = await prisma.refreshSession.findUnique({ where: { tokenHash: hash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new ApiError(401, "Refresh session is invalid or expired");
    }
    await prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await setRefresh(res, session.user.id);
    return ok(res, { accessToken: accessToken(session.user.id), user: publicUser(session.user) }, "Session refreshed");
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[refreshCookie] as string | undefined;
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await prisma.refreshSession.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(refreshCookie, { path: "/api/auth" });
    return ok(res, null, "Logged out");
  })
);

router.get("/me", authenticate, asyncHandler(async (req, res) => ok(res, req.auth, "Current user")));

router.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const input = passwordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new ApiError(400, "Current password is incorrect");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await prisma.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, { action: "PASSWORD_CHANGE", entityType: "USER", entityId: user.id });
    return ok(res, null, "Password changed. Please sign in again.");
  })
);

export default router;
