import { Router } from "express";
import bcrypt from "bcryptjs";
import { UserRole, UnitType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../lib/activity.js";
import { ApiError, asyncHandler, ok, pathParam } from "../lib/http.js";
import { allow, authenticate, requireChangedPassword } from "../middleware/auth.js";

const router = Router();
router.use(authenticate, requireChangedPassword);

const userCreate = z.object({
  fullName: z.string().min(2),
  username: z.string().trim().min(3),
  password: z.string().min(10).default("Admin@12345"),
  role: z.nativeEnum(UserRole),
  policeUnitId: z.string().uuid().nullable().optional(),
  mobileNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal(""))
});
const unitInput = z.object({
  name: z.string().min(2),
  unitType: z.nativeEnum(UnitType),
  address: z.string().optional(),
  contactNumber: z.string().optional()
});
const designationInput = z.object({ code: z.string().min(1).max(20), name: z.string().min(2), rankOrder: z.coerce.number().int(), isActive: z.boolean().optional() });
const quarterTypeInput = z.object({ name: z.string().min(1), description: z.string().optional(), isActive: z.boolean().optional() });
const areaInput = z.object({ name: z.string().min(2), description: z.string().optional(), address: z.string().optional(), isActive: z.boolean().optional() });
const eligibilityInput = z.object({
  designationId: z.string().uuid(),
  quarterTypeId: z.string().uuid(),
  isEligible: z.boolean(),
  requiresSpecialApproval: z.boolean().default(false),
  remarks: z.string().optional()
});

router.get("/users", allow(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ include: { policeUnit: true }, orderBy: { username: "asc" } });
  return ok(res, users.map(({ passwordHash: _passwordHash, ...user }) => user));
}));
router.post("/users", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const input = userCreate.parse(req.body);
  const { password, ...userData } = input;
  const user = await prisma.user.create({
    data: { ...userData, email: userData.email || null, passwordHash: await bcrypt.hash(password, 12) }
  });
  await audit(req, { action: "USER_CREATE", entityType: "USER", entityId: user.id, newValue: { username: user.username, role: user.role } });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return ok(res, safeUser, "User created", 201);
}));
router.get("/users/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: pathParam(req) }, include: { policeUnit: true } });
  if (!user) throw new ApiError(404, "User not found");
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return ok(res, safeUser);
}));
router.patch("/users/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const input = userCreate.omit({ password: true }).partial().parse(req.body);
  const user = await prisma.user.update({ where: { id: pathParam(req) }, data: { ...input, email: input.email || undefined } });
  await audit(req, { action: "USER_UPDATE", entityType: "USER", entityId: user.id, newValue: input });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return ok(res, safeUser, "User updated");
}));
router.patch("/users/:id/status", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const user = await prisma.user.update({ where: { id: pathParam(req) }, data: { isActive } });
  await audit(req, { action: "USER_STATUS_CHANGE", entityType: "USER", entityId: user.id, newValue: { isActive } });
  return ok(res, { id: user.id, isActive }, "User status updated");
}));
router.post("/users/:id/reset-password", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { password } = z.object({ password: z.string().min(10).default("Admin@12345") }).parse(req.body);
  const id = pathParam(req);
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } });
  await prisma.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, { action: "PASSWORD_RESET", entityType: "USER", entityId: id });
  return ok(res, null, "Password reset; user must change it at next login");
}));

router.get("/police-units", asyncHandler(async (_req, res) => ok(res, await prisma.policeUnit.findMany({ orderBy: { name: "asc" } }))));
router.post("/police-units", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.policeUnit.create({ data: unitInput.parse(req.body) });
  await audit(req, { action: "POLICE_UNIT_CREATE", entityType: "POLICE_UNIT", entityId: value.id, newValue: value });
  return ok(res, value, "Police unit created", 201);
}));
router.patch("/police-units/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.policeUnit.update({ where: { id: pathParam(req) }, data: unitInput.partial().parse(req.body) });
  await audit(req, { action: "POLICE_UNIT_UPDATE", entityType: "POLICE_UNIT", entityId: value.id, newValue: value });
  return ok(res, value, "Police unit updated");
}));
router.delete("/police-units/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.policeUnit.update({ where: { id: pathParam(req) }, data: { isActive: false } });
  await audit(req, { action: "POLICE_UNIT_DEACTIVATE", entityType: "POLICE_UNIT", entityId: value.id });
  return ok(res, value, "Police unit deactivated");
}));

router.get("/designations", asyncHandler(async (_req, res) => ok(res, await prisma.designation.findMany({ orderBy: { rankOrder: "asc" } }))));
router.post("/designations", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.designation.create({ data: designationInput.parse(req.body) });
  await audit(req, { action: "DESIGNATION_CREATE", entityType: "DESIGNATION", entityId: value.id, newValue: value });
  return ok(res, value, "Designation created", 201);
}));
router.patch("/designations/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.designation.update({ where: { id: pathParam(req) }, data: designationInput.partial().parse(req.body) });
  await audit(req, { action: "DESIGNATION_UPDATE", entityType: "DESIGNATION", entityId: value.id, newValue: value });
  return ok(res, value, "Designation updated");
}));
router.delete("/designations/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.designation.update({ where: { id: pathParam(req) }, data: { isActive: false } });
  await audit(req, { action: "DESIGNATION_DEACTIVATE", entityType: "DESIGNATION", entityId: value.id });
  return ok(res, value, "Designation deactivated");
}));

router.get("/quarter-types", asyncHandler(async (_req, res) => ok(res, await prisma.quarterType.findMany({ orderBy: { name: "asc" } }))));
router.post("/quarter-types", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.quarterType.create({ data: quarterTypeInput.parse(req.body) });
  await audit(req, { action: "QUARTER_TYPE_CREATE", entityType: "QUARTER_TYPE", entityId: value.id, newValue: value });
  return ok(res, value, "Quarter type created", 201);
}));
router.patch("/quarter-types/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.quarterType.update({ where: { id: pathParam(req) }, data: quarterTypeInput.partial().parse(req.body) });
  await audit(req, { action: "QUARTER_TYPE_UPDATE", entityType: "QUARTER_TYPE", entityId: value.id, newValue: value });
  return ok(res, value, "Quarter type updated");
}));
router.delete("/quarter-types/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.quarterType.update({ where: { id: pathParam(req) }, data: { isActive: false } });
  await audit(req, { action: "QUARTER_TYPE_DEACTIVATE", entityType: "QUARTER_TYPE", entityId: value.id });
  return ok(res, value, "Quarter type deactivated");
}));

router.get("/areas", asyncHandler(async (_req, res) => ok(res, await prisma.area.findMany({ orderBy: { name: "asc" } }))));
router.post("/areas", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.area.create({ data: areaInput.parse(req.body) });
  await audit(req, { action: "AREA_CREATE", entityType: "AREA", entityId: value.id, newValue: value });
  return ok(res, value, "Area created", 201);
}));
router.patch("/areas/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.area.update({ where: { id: pathParam(req) }, data: areaInput.partial().parse(req.body) });
  await audit(req, { action: "AREA_UPDATE", entityType: "AREA", entityId: value.id, newValue: value });
  return ok(res, value, "Area updated");
}));
router.delete("/areas/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.area.update({ where: { id: pathParam(req) }, data: { isActive: false } });
  await audit(req, { action: "AREA_DEACTIVATE", entityType: "AREA", entityId: value.id });
  return ok(res, value, "Area deactivated");
}));

router.get("/eligibility-rules", asyncHandler(async (_req, res) => ok(res, await prisma.eligibilityRule.findMany({ include: { designation: true, quarterType: true }, orderBy: { designation: { rankOrder: "asc" } } }))));
router.get("/eligibility-rules/check", asyncHandler(async (req, res) => {
  const input = z.object({ designationId: z.string().uuid(), quarterTypeId: z.string().uuid() }).parse(req.query);
  const rule = await prisma.eligibilityRule.findUnique({ where: { designationId_quarterTypeId: input } });
  return ok(res, { eligible: rule?.isEligible ?? false, requiresSpecialApproval: rule?.requiresSpecialApproval ?? false, reason: rule?.remarks });
}));
router.post("/eligibility-rules", allow(UserRole.ADMIN), asyncHandler(async (req, res) => ok(res, await prisma.eligibilityRule.create({ data: eligibilityInput.parse(req.body) }), "Eligibility rule created", 201)));
router.patch("/eligibility-rules/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const value = await prisma.eligibilityRule.update({ where: { id: pathParam(req) }, data: eligibilityInput.partial().parse(req.body) });
  await audit(req, { action: "ELIGIBILITY_UPDATE", entityType: "ELIGIBILITY_RULE", entityId: value.id, newValue: value });
  return ok(res, value, "Eligibility updated");
}));

export default router;
