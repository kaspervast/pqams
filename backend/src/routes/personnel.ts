import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../lib/activity.js";
import { ApiError, asyncHandler, ok, pathParam } from "../lib/http.js";
import { allow, authenticate, requireChangedPassword } from "../middleware/auth.js";
import { activeApplicationStatuses } from "../services/workflow.js";

const router = Router();
router.use(authenticate, requireChangedPassword);
const inputSchema = z.object({
  indexNumber: z.string().trim().min(1),
  buckleNumber: z.string().trim().min(1),
  fullName: z.string().trim().min(2),
  mobileNumber: z.string().trim().min(10),
  designationId: z.string().uuid(),
  currentPoliceUnitId: z.string().uuid(),
  currentAddress: z.string().trim().min(5)
});
const include = {
  designation: true,
  currentPoliceUnit: true,
  occupancies: { where: { isCurrent: true }, include: { quarter: { include: { area: true, quarterType: true } } } },
  applications: { orderBy: { createdAt: "desc" as const }, take: 5 }
};

router.get("/personnel", asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const where = req.auth!.role === UserRole.UNIT_USER ? { currentPoliceUnitId: req.auth!.policeUnitId! } : {};
  return ok(res, await prisma.personnel.findMany({
    where: { ...where, OR: q ? [{ fullName: { contains: q, mode: "insensitive" } }, { indexNumber: { contains: q } }, { buckleNumber: { contains: q } }] : undefined },
    include,
    orderBy: { fullName: "asc" }
  }));
}));
router.post("/personnel", allow(UserRole.ADMIN, UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const input = inputSchema.parse(req.body);
  if (req.auth!.role === UserRole.UNIT_USER && input.currentPoliceUnitId !== req.auth!.policeUnitId) throw new ApiError(403, "Personnel must belong to your unit");
  const value = await prisma.personnel.create({ data: { ...input, createdById: req.auth!.id }, include });
  await audit(req, { action: "PERSONNEL_CREATE", entityType: "PERSONNEL", entityId: value.id, newValue: input });
  return ok(res, value, "Personnel created", 201);
}));
router.patch("/personnel/:id", allow(UserRole.ADMIN, UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const input = inputSchema.partial().parse(req.body);
  const existing = await prisma.personnel.findUniqueOrThrow({ where: { id: pathParam(req) } });
  if (req.auth!.role === UserRole.UNIT_USER && existing.currentPoliceUnitId !== req.auth!.policeUnitId) throw new ApiError(403, "Not authorized for this personnel record");
  const value = await prisma.personnel.update({ where: { id: existing.id }, data: { ...input, updatedById: req.auth!.id }, include });
  await audit(req, { action: "PERSONNEL_UPDATE", entityType: "PERSONNEL", entityId: value.id, oldValue: existing, newValue: input });
  return ok(res, value, "Personnel updated");
}));
router.delete("/personnel/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const id = pathParam(req);
  const existing = await prisma.personnel.findUniqueOrThrow({
    where: { id },
    include: {
      occupancies: { where: { isCurrent: true } },
      applications: { where: { status: { in: activeApplicationStatuses } } }
    }
  });
  if (existing.occupancies.length) throw new ApiError(409, "Personnel with a current quarter cannot be deactivated");
  if (existing.applications.length) throw new ApiError(409, "Personnel with an active application cannot be deactivated");
  const value = await prisma.personnel.update({ where: { id }, data: { isActive: false, updatedById: req.auth!.id } });
  await audit(req, { action: "PERSONNEL_DEACTIVATE", entityType: "PERSONNEL", entityId: value.id });
  return ok(res, value, "Personnel deactivated");
}));
router.get("/personnel/search-duplicate", asyncHandler(async (req, res) => {
  const search = z.object({ indexNumber: z.string().optional(), buckleNumber: z.string().optional(), mobileNumber: z.string().optional(), name: z.string().optional() }).parse(req.query);
  const matches = await prisma.personnel.findMany({
    where: {
      OR: [
        search.indexNumber ? { indexNumber: search.indexNumber } : undefined,
        search.buckleNumber ? { buckleNumber: search.buckleNumber } : undefined,
        search.mobileNumber ? { mobileNumber: search.mobileNumber } : undefined,
        search.name ? { fullName: { contains: search.name, mode: "insensitive" } } : undefined
      ].filter(Boolean) as never
    },
    include
  });
  return ok(res, matches.map((person) => ({
    person,
    currentQuarter: person.occupancies[0]?.quarter ?? null,
    activeApplication: person.applications.find((application) => activeApplicationStatuses.includes(application.status)) ?? null,
    previousApplications: person.applications.filter((application) => !activeApplicationStatuses.includes(application.status))
  })));
}));
router.get("/personnel/by-index/:indexNumber", asyncHandler(async (req, res) => {
  const value = await prisma.personnel.findUnique({ where: { indexNumber: pathParam(req, "indexNumber") }, include });
  if (!value) throw new ApiError(404, "Personnel not found");
  return ok(res, value);
}));
router.get("/personnel/by-buckle/:buckleNumber", asyncHandler(async (req, res) => {
  const value = await prisma.personnel.findUnique({ where: { buckleNumber: pathParam(req, "buckleNumber") }, include });
  if (!value) throw new ApiError(404, "Personnel not found");
  return ok(res, value);
}));
router.get("/personnel/:id", asyncHandler(async (req, res) => {
  const value = await prisma.personnel.findUnique({ where: { id: pathParam(req) }, include });
  if (!value) throw new ApiError(404, "Personnel not found");
  return ok(res, value);
}));
router.get("/personnel/:id/current-occupancy", asyncHandler(async (req, res) => ok(res, await prisma.occupancyRecord.findFirst({ where: { personnelId: pathParam(req), isCurrent: true }, include: { quarter: { include: { area: true, quarterType: true } } } }))));
router.get("/personnel/:id/application-history", asyncHandler(async (req, res) => ok(res, await prisma.application.findMany({ where: { personnelId: pathParam(req) }, orderBy: { createdAt: "desc" } }))));

export default router;
