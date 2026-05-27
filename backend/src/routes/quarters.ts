import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { ChangeRequestStatus, ChangeRequestType, Prisma, QuarterStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../lib/activity.js";
import { ApiError, asyncHandler, ok, pathParam } from "../lib/http.js";
import { allow, authenticate, requireChangedPassword } from "../middleware/auth.js";

const router = Router();
router.use(authenticate, requireChangedPassword);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const quarterInput = z.object({
  areaId: z.string().uuid(),
  quarterTypeId: z.string().uuid(),
  wing: z.string().nullable().optional(),
  block: z.string().nullable().optional(),
  floor: z.string().nullable().optional(),
  houseNumber: z.string().min(1),
  fullQuarterCode: z.string().nullable().optional(),
  status: z.nativeEnum(QuarterStatus).default(QuarterStatus.AVAILABLE),
  conditionRemarks: z.string().nullable().optional(),
  electricityMeterNo: z.string().nullable().optional(),
  waterConnectionNo: z.string().nullable().optional()
});
const statusInput = z.object({ status: z.nativeEnum(QuarterStatus), reason: z.string().min(2).optional() });

const quarterInclude = {
  area: true,
  quarterType: true,
  occupancies: {
    where: { isCurrent: true },
    include: { personnel: { include: { designation: true, currentPoliceUnit: true } } }
  }
} satisfies Prisma.QuarterInclude;

router.get("/quarters", asyncHandler(async (req, res) => {
  const filters = z.object({
    areaId: z.string().uuid().optional(),
    quarterTypeId: z.string().uuid().optional(),
    status: z.nativeEnum(QuarterStatus).optional(),
    houseNumber: z.string().optional(),
    availableOnly: z.enum(["true", "false"]).optional()
  }).parse(req.query);
  const status = filters.availableOnly === "true" ? QuarterStatus.AVAILABLE : filters.status;
  const quarters = await prisma.quarter.findMany({
    where: {
      areaId: filters.areaId,
      quarterTypeId: filters.quarterTypeId,
      status,
      houseNumber: filters.houseNumber ? { contains: filters.houseNumber, mode: "insensitive" } : undefined,
      isActive: true
    },
    include: quarterInclude,
    orderBy: [{ area: { name: "asc" } }, { houseNumber: "asc" }]
  });
  return ok(res, quarters);
}));
router.get("/quarters/available", asyncHandler(async (req, res) => {
  const input = z.object({ areaId: z.string().uuid().optional(), quarterTypeId: z.string().uuid().optional() }).parse(req.query);
  return ok(res, await prisma.quarter.findMany({
    where: { ...input, status: QuarterStatus.AVAILABLE, isActive: true, approvedByAdmin: true },
    include: { area: true, quarterType: true }
  }));
}));
router.get("/quarters/summary", asyncHandler(async (_req, res) => {
  const grouped = await prisma.quarter.groupBy({ by: ["status"], _count: true, where: { isActive: true } });
  return ok(res, grouped);
}));
router.get("/quarters/:id", asyncHandler(async (req, res) => {
  const quarter = await prisma.quarter.findUnique({ where: { id: pathParam(req) }, include: { ...quarterInclude, statusHistory: true } });
  if (!quarter) throw new ApiError(404, "Quarter not found");
  return ok(res, quarter);
}));
router.post("/quarters", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const input = quarterInput.parse(req.body);
  if (input.status === QuarterStatus.OCCUPIED) throw new ApiError(400, "Create an available quarter and record occupancy through the controlled occupancy action");
  if (req.auth!.role === UserRole.CORRESPONDENCE_BRANCH) {
    const request = await prisma.quarterChangeRequest.create({
      data: { requestType: ChangeRequestType.CREATE_QUARTER, payload: input, createdById: req.auth!.id }
    });
    await audit(req, { action: "QUARTER_CREATE_REQUEST", entityType: "QUARTER_CHANGE_REQUEST", entityId: request.id, newValue: input });
    return ok(res, request, "Quarter creation submitted for Admin approval", 202);
  }
  const quarter = await prisma.quarter.create({
    data: { ...input, createdById: req.auth!.id, approvedByAdmin: true, adminApprovedById: req.auth!.id, adminApprovedAt: new Date() },
    include: quarterInclude
  });
  await audit(req, { action: "QUARTER_CREATE", entityType: "QUARTER", entityId: quarter.id, newValue: input });
  return ok(res, quarter, "Quarter created", 201);
}));
router.patch("/quarters/:id", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const input = quarterInput.omit({ status: true }).partial().parse(req.body);
  if (req.auth!.role === UserRole.CORRESPONDENCE_BRANCH) {
    const request = await prisma.quarterChangeRequest.create({
      data: { requestType: ChangeRequestType.UPDATE_QUARTER, quarterId: pathParam(req), payload: input, createdById: req.auth!.id }
    });
    return ok(res, request, "Quarter update submitted for Admin approval", 202);
  }
  const original = await prisma.quarter.findUniqueOrThrow({ where: { id: pathParam(req) } });
  const quarter = await prisma.quarter.update({ where: { id: pathParam(req) }, data: { ...input, updatedById: req.auth!.id } });
  await audit(req, { action: "QUARTER_UPDATE", entityType: "QUARTER", entityId: quarter.id, oldValue: original, newValue: quarter });
  return ok(res, quarter, "Quarter updated");
}));
router.delete("/quarters/:id", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const id = pathParam(req);
  const quarter = await prisma.quarter.findUniqueOrThrow({
    where: { id },
    include: { occupancies: { where: { isCurrent: true } }, currentApplications: { where: { status: { notIn: ["REJECTED", "CANCELLED", "CLOSED"] } } } }
  });
  if (quarter.occupancies.length) throw new ApiError(409, "An occupied quarter cannot be deactivated");
  if (quarter.currentApplications.length) throw new ApiError(409, "A quarter linked to an active application cannot be deactivated");
  const value = await prisma.$transaction(async (tx) => {
    const updated = await tx.quarter.update({ where: { id }, data: { isActive: false, status: QuarterStatus.INACTIVE, updatedById: req.auth!.id } });
    await tx.quarterStatusHistory.create({ data: { quarterId: id, oldStatus: quarter.status, newStatus: QuarterStatus.INACTIVE, reason: "Deactivated by Admin", changedById: req.auth!.id } });
    return updated;
  });
  await audit(req, { action: "QUARTER_DEACTIVATE", entityType: "QUARTER", entityId: value.id });
  return ok(res, value, "Quarter deactivated");
}));
router.patch("/quarters/:id/status", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const input = statusInput.parse(req.body);
  if (input.status === QuarterStatus.OCCUPIED) throw new ApiError(400, "A quarter becomes occupied only through controlled occupancy or Super Admin allotment");
  const old = await prisma.quarter.findUniqueOrThrow({ where: { id: pathParam(req) } });
  if (req.auth!.role === UserRole.CORRESPONDENCE_BRANCH) {
    const request = await prisma.quarterChangeRequest.create({
      data: { requestType: ChangeRequestType.STATUS_CHANGE, quarterId: old.id, payload: input, createdById: req.auth!.id }
    });
    return ok(res, request, "Status change submitted for Admin approval", 202);
  }
  const quarter = await prisma.$transaction(async (tx) => {
    const value = await tx.quarter.update({ where: { id: old.id }, data: { status: input.status, updatedById: req.auth!.id } });
    await tx.quarterStatusHistory.create({ data: { quarterId: old.id, oldStatus: old.status, newStatus: input.status, reason: input.reason, changedById: req.auth!.id } });
    return value;
  });
  await audit(req, { action: "QUARTER_STATUS_CHANGE", entityType: "QUARTER", entityId: old.id, oldValue: { status: old.status }, newValue: input });
  return ok(res, quarter, "Quarter status updated");
}));

router.get("/occupancy-records", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH, UserRole.SUPER_ADMIN, UserRole.VIEWER), asyncHandler(async (_req, res) => {
  return ok(res, await prisma.occupancyRecord.findMany({ include: { quarter: { include: { area: true, quarterType: true } }, personnel: { include: { designation: true, currentPoliceUnit: true } } }, orderBy: { allocatedDate: "desc" } }));
}));
const occupancyInput = z.object({
  personnelId: z.string().uuid(), quarterId: z.string().uuid(), allocatedDate: z.coerce.date(), possessionDate: z.coerce.date().optional(),
  allocationReferenceNo: z.string().optional(), remarks: z.string().optional()
});
router.post("/occupancy-records", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const input = occupancyInput.parse(req.body);
  const occupancy = await prisma.$transaction(async (tx) => {
    const quarter = await tx.quarter.findUniqueOrThrow({ where: { id: input.quarterId } });
    if (quarter.status !== QuarterStatus.AVAILABLE) throw new ApiError(409, "Only available quarters can be occupied");
    const value = await tx.occupancyRecord.create({ data: { ...input, createdById: req.auth!.id } });
    await tx.quarter.update({ where: { id: input.quarterId }, data: { status: QuarterStatus.OCCUPIED } });
    await tx.quarterStatusHistory.create({ data: { quarterId: input.quarterId, oldStatus: quarter.status, newStatus: QuarterStatus.OCCUPIED, reason: "Initial occupancy entry", changedById: req.auth!.id } });
    return value;
  });
  await audit(req, { action: "OCCUPANCY_CREATE", entityType: "OCCUPANCY_RECORD", entityId: occupancy.id, newValue: input });
  return ok(res, occupancy, "Occupancy created", 201);
}));

async function parseImport(file: Express.Multer.File) {
  if (file.originalname.toLowerCase().endsWith(".csv")) return parseCsv(file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, "Workbook has no worksheet");
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = (row.values as unknown[]).slice(1);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? "")])));
  });
  return rows;
}

async function importApprovedRows(rows: Record<string, string>[], actorId: string) {
  const [areas, types, designations, units] = await Promise.all([
    prisma.area.findMany(), prisma.quarterType.findMany(), prisma.designation.findMany(), prisma.policeUnit.findMany()
  ]);
  const results: Array<{ index: number; errors: string[] }> = [];
  let imported = 0;
  for (const [offset, row] of rows.entries()) {
    const errors: string[] = [];
    const area = areas.find((item) => item.name.toLowerCase() === row.Area?.toLowerCase());
    const quarterType = types.find((item) => item.name.toLowerCase() === row["Quarter Type"]?.toLowerCase());
    const status = Object.values(QuarterStatus).includes(row.Status as QuarterStatus) ? row.Status as QuarterStatus : QuarterStatus.AVAILABLE;
    if (!area) errors.push("Unknown area");
    if (!quarterType) errors.push("Unknown quarter type");
    if (!row["House Number"]) errors.push("Missing house number");
    const occupied = status === QuarterStatus.OCCUPIED;
    const designation = designations.find((item) => item.code.toLowerCase() === row["Resident Designation"]?.toLowerCase());
    const posting = units.find((item) => item.name.toLowerCase() === row["Resident Posting"]?.toLowerCase());
    if (occupied) {
      if (!row["Resident Index Number"] || !row["Resident Buckle Number"] || !row["Resident Name"] || !row["Resident Mobile Number"] || !row["Allocated Date"]) {
        errors.push("Occupied row requires complete resident details and allocated date");
      }
      if (!designation) errors.push("Unknown resident designation");
      if (!posting) errors.push("Unknown resident posting");
    }
    if (errors.length) { results.push({ index: offset + 2, errors }); continue; }
    try {
      await prisma.$transaction(async (tx) => {
        const quarter = await tx.quarter.create({
          data: {
            areaId: area!.id, quarterTypeId: quarterType!.id, wing: row.Wing || null, block: row.Block || null,
            floor: row.Floor || null, houseNumber: row["House Number"], status: occupied ? QuarterStatus.AVAILABLE : status,
            conditionRemarks: row["Condition Remarks"] || null, electricityMeterNo: row["Electricity Meter No"] || null,
            waterConnectionNo: row["Water Connection No"] || null, createdById: actorId, approvedByAdmin: true,
            adminApprovedById: actorId, adminApprovedAt: new Date()
          }
        });
        if (occupied) {
          let person = await tx.personnel.findFirst({ where: { OR: [{ indexNumber: row["Resident Index Number"] }, { buckleNumber: row["Resident Buckle Number"] }] } });
          person ??= await tx.personnel.create({
            data: {
              indexNumber: row["Resident Index Number"], buckleNumber: row["Resident Buckle Number"], fullName: row["Resident Name"],
              mobileNumber: row["Resident Mobile Number"], designationId: designation!.id, currentPoliceUnitId: posting!.id,
              currentAddress: "Imported occupied quarter record", createdById: actorId
            }
          });
          const allocatedDate = new Date(row["Allocated Date"]);
          if (Number.isNaN(allocatedDate.valueOf())) throw new Error("Invalid allocated date");
          await tx.occupancyRecord.create({ data: { personnelId: person.id, quarterId: quarter.id, allocatedDate, createdById: actorId } });
          await tx.quarter.update({ where: { id: quarter.id }, data: { status: QuarterStatus.OCCUPIED } });
          await tx.quarterStatusHistory.create({ data: { quarterId: quarter.id, oldStatus: QuarterStatus.AVAILABLE, newStatus: QuarterStatus.OCCUPIED, reason: "Approved legacy occupancy import", changedById: actorId } });
        }
      });
      imported += 1;
    } catch {
      results.push({ index: offset + 2, errors: ["Duplicate quarter/personnel occupancy or invalid row"] });
    }
  }
  return { totalRows: rows.length, validRows: rows.length - results.length, invalidRows: results, rowsImported: imported, rowsSkipped: rows.length - imported };
}

router.post("/quarters/bulk-upload", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH), upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "CSV or XLSX file is required");
  const rows = await parseImport(req.file);
  const areas = await prisma.area.findMany();
  const types = await prisma.quarterType.findMany();
  const valid = rows.map((row, index) => {
    const area = areas.find((a) => a.name.toLowerCase() === row.Area?.toLowerCase());
    const quarterType = types.find((t) => t.name.toLowerCase() === row["Quarter Type"]?.toLowerCase());
    const status = Object.values(QuarterStatus).includes(row.Status as QuarterStatus) ? row.Status as QuarterStatus : QuarterStatus.AVAILABLE;
    const errors = [!area && "Unknown area", !quarterType && "Unknown quarter type", !row["House Number"] && "Missing house number"].filter(Boolean) as string[];
    if (status === QuarterStatus.OCCUPIED && (!row["Resident Index Number"] || !row["Resident Buckle Number"] || !row["Resident Name"] || !row["Resident Mobile Number"] || !row["Resident Designation"] || !row["Resident Posting"] || !row["Allocated Date"])) {
      errors.push("Occupied row requires resident details");
    }
    return { index: index + 2, row, area, quarterType, status, errors };
  });
  const invalidRows = valid.filter((v) => v.errors.length);
  if (req.auth!.role === UserRole.CORRESPONDENCE_BRANCH) {
    const request = await prisma.quarterChangeRequest.create({
      data: { requestType: ChangeRequestType.BULK_IMPORT, payload: rows, createdById: req.auth!.id }
    });
    return ok(res, { totalRows: rows.length, validRows: valid.length - invalidRows.length, invalidRows, rowsImported: 0, requestId: request.id }, "Import submitted for Admin approval", 202);
  }
  const result = await importApprovedRows(rows, req.auth!.id);
  await audit(req, { action: "QUARTER_BULK_IMPORT", entityType: "QUARTER", newValue: result });
  return ok(res, result, "Import processed");
}));

router.get("/quarter-change-requests", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const where = req.auth!.role === UserRole.ADMIN ? {} : { createdById: req.auth!.id };
  return ok(res, await prisma.quarterChangeRequest.findMany({ where, include: { createdBy: true, quarter: true }, orderBy: { createdAt: "desc" } }));
}));
router.post("/quarter-change-requests/:id/approve", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const request = await prisma.quarterChangeRequest.findUniqueOrThrow({ where: { id: pathParam(req) } });
  if (request.status !== ChangeRequestStatus.PENDING) throw new ApiError(409, "Request is already processed");
  const payload = request.payload as Record<string, unknown>;
  await prisma.$transaction(async (tx) => {
    if (request.requestType === ChangeRequestType.CREATE_QUARTER) {
      await tx.quarter.create({ data: { ...quarterInput.parse(payload), approvedByAdmin: true, adminApprovedById: req.auth!.id, adminApprovedAt: new Date(), createdById: request.createdById } });
    } else if (request.requestType === ChangeRequestType.UPDATE_QUARTER && request.quarterId) {
      await tx.quarter.update({ where: { id: request.quarterId }, data: { ...quarterInput.partial().parse(payload), updatedById: req.auth!.id } });
    } else if (request.requestType === ChangeRequestType.STATUS_CHANGE && request.quarterId) {
      const existing = await tx.quarter.findUniqueOrThrow({ where: { id: request.quarterId } });
      const change = statusInput.parse(payload);
      await tx.quarter.update({ where: { id: request.quarterId }, data: { status: change.status, updatedById: req.auth!.id } });
      await tx.quarterStatusHistory.create({ data: { quarterId: existing.id, oldStatus: existing.status, newStatus: change.status, reason: change.reason, changedById: req.auth!.id } });
    }
    await tx.quarterChangeRequest.update({ where: { id: request.id }, data: { status: ChangeRequestStatus.APPROVED, reviewedById: req.auth!.id, reviewedAt: new Date() } });
  });
  if (request.requestType === ChangeRequestType.BULK_IMPORT) {
    const result = await importApprovedRows(request.payload as Record<string, string>[], req.auth!.id);
    await audit(req, { action: "QUARTER_BULK_IMPORT_APPROVE", entityType: "QUARTER_CHANGE_REQUEST", entityId: request.id, newValue: result });
  }
  await audit(req, { action: "QUARTER_REQUEST_APPROVE", entityType: "QUARTER_CHANGE_REQUEST", entityId: request.id });
  return ok(res, null, "Change request approved");
}));
router.post("/quarter-change-requests/:id/reject", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { remarks } = z.object({ remarks: z.string().optional() }).parse(req.body);
  const id = pathParam(req);
  await prisma.quarterChangeRequest.update({ where: { id }, data: { status: ChangeRequestStatus.REJECTED, remarks, reviewedById: req.auth!.id, reviewedAt: new Date() } });
  await audit(req, { action: "QUARTER_REQUEST_REJECT", entityType: "QUARTER_CHANGE_REQUEST", entityId: id });
  return ok(res, null, "Change request rejected");
}));

export default router;
