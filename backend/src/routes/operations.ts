import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ApplicationStatus, QuarterStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../lib/activity.js";
import { ApiError, asyncHandler, ok, pathParam } from "../lib/http.js";
import { allow, authenticate, requireChangedPassword } from "../middleware/auth.js";
import { seniorityApplicationStatuses } from "../services/workflow.js";

const router = Router();
router.use(authenticate, requireChangedPassword);

router.get("/notifications", asyncHandler(async (req, res) => ok(res, await prisma.notification.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: "desc" }, take: 50 }))));
router.patch("/notifications/:id/read", asyncHandler(async (req, res) => {
  const updated = await prisma.notification.updateMany({ where: { id: pathParam(req), userId: req.auth!.id }, data: { isRead: true } });
  if (!updated.count) throw new ApiError(404, "Notification not found");
  return ok(res, null, "Notification read");
}));
router.get("/audit-logs", allow(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER), asyncHandler(async (_req, res) => {
  return ok(res, await prisma.auditLog.findMany({ include: { user: { select: { fullName: true, username: true } } }, orderBy: { createdAt: "desc" }, take: 500 }));
}));

const active = [
  ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.DUPLICATE_REVIEW, ApplicationStatus.ADMIN_REVIEW,
  ApplicationStatus.CORRESPONDENCE_REVIEW, ApplicationStatus.SUPER_ADMIN_REVIEW, ApplicationStatus.RETURNED_FOR_RECONSIDERATION,
  ApplicationStatus.APPROVED_WAITLIST, ApplicationStatus.APPROVED_PENDING_ALLOTMENT
];
async function applicationCounts(unitId?: string) {
  const where = unitId ? { submittedByUnitId: unitId } : {};
  const [pending, returned, allotted, rejected] = await Promise.all([
    prisma.application.count({ where: { ...where, status: { in: active } } }),
    prisma.application.count({ where: { ...where, status: ApplicationStatus.RETURNED_FOR_RECONSIDERATION } }),
    prisma.application.count({ where: { ...where, status: ApplicationStatus.CLOSED } }),
    prisma.application.count({ where: { ...where, status: ApplicationStatus.REJECTED } })
  ]);
  return { pending, returned, allotted, rejected };
}
router.get("/dashboard/super-admin", allow(UserRole.SUPER_ADMIN, UserRole.VIEWER), asyncHandler(async (_req, res) => {
  const [counts, specialCases, newRequests, transfers, available, occupied, waitlisted, aging, queue, summary] = await Promise.all([
    applicationCounts(),
    prisma.application.count({ where: { isSpecialCase: true, status: { in: active } } }),
    prisma.application.count({ where: { applicationType: "NEW_ALLOTMENT", status: { in: active } } }),
    prisma.application.count({ where: { applicationType: "TRANSFER_CHANGE", status: { in: active } } }),
    prisma.quarter.count({ where: { status: QuarterStatus.AVAILABLE } }),
    prisma.quarter.count({ where: { status: QuarterStatus.OCCUPIED } }),
    prisma.application.count({ where: { status: ApplicationStatus.APPROVED_WAITLIST } }),
    prisma.application.count({ where: { status: { in: active }, submittedAt: { lte: new Date(Date.now() - 15 * 86400000) } } }),
    prisma.application.findMany({ where: { status: { in: [ApplicationStatus.SUPER_ADMIN_REVIEW, ApplicationStatus.APPROVED_PENDING_ALLOTMENT] } }, include: { personnel: true }, orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }], take: 10 }),
    prisma.quarter.groupBy({ by: ["status"], _count: true })
  ]);
  return ok(res, { ...counts, specialCases, newRequests, transfers, available, occupied, waitlisted, aging, queue, summary });
}));
router.get("/dashboard/admin", allow(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const [users, units, quarters, duplicates, changes, counts, summary, queue] = await Promise.all([
    prisma.user.count(), prisma.policeUnit.count(), prisma.quarter.count(),
    prisma.application.count({ where: { status: ApplicationStatus.DUPLICATE_REVIEW } }),
    prisma.quarterChangeRequest.count({ where: { status: "PENDING" } }),
    applicationCounts(),
    prisma.quarter.groupBy({ by: ["status"], _count: true, where: { isActive: true } }),
    prisma.application.findMany({ where: { status: { in: active } }, include: { personnel: true }, orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }], take: 8 })
  ]);
  return ok(res, { users, units, quarters, duplicates, changes, ...counts, summary, queue });
}));
router.get("/dashboard/correspondence", allow(UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (_req, res) => {
  const [statuses, verification, queue] = await Promise.all([
    prisma.quarter.groupBy({ by: ["status"], _count: true, where: { isActive: true } }),
    prisma.application.count({ where: { status: ApplicationStatus.CORRESPONDENCE_REVIEW } }),
    prisma.application.findMany({ where: { status: ApplicationStatus.CORRESPONDENCE_REVIEW }, include: { personnel: true }, orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }], take: 8 })
  ]);
  return ok(res, { statuses, verification, queue });
}));
router.get("/dashboard/unit", allow(UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const unitId = req.auth!.policeUnitId!;
  const [counts, seniorityQueue] = await Promise.all([
    applicationCounts(unitId),
    prisma.application.findMany({
      where: { status: { in: seniorityApplicationStatuses }, submittedAt: { not: null } },
      include: { personnel: true, preferences: { include: { quarterType: true }, orderBy: { preferenceOrder: "asc" } } },
      orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }, { createdAt: "asc" }]
    })
  ]);
  const caseCounters = new Map<string, number>();
  const typeCounters = new Map<string, number>();
  const typeCaseCounters = new Map<string, number>();
  const seniority = seniorityQueue
    .map((application, index) => {
      const caseType = application.isSpecialCase ? "SPECIAL" : "REGULAR";
      const caseLabel = application.isSpecialCase ? "Special Case" : "Regular";
      const casePosition = (caseCounters.get(caseType) ?? 0) + 1;
      caseCounters.set(caseType, casePosition);
      const typeSeniority = [...new Map(application.preferences.map((preference) => [preference.quarterTypeId, preference.quarterType.name])).entries()]
        .map(([quarterTypeId, quarterType]) => {
          const position = (typeCounters.get(quarterTypeId) ?? 0) + 1;
          const typeCaseKey = `${quarterTypeId}:${caseType}`;
          const typeCasePosition = (typeCaseCounters.get(typeCaseKey) ?? 0) + 1;
          typeCounters.set(quarterTypeId, position);
          typeCaseCounters.set(typeCaseKey, typeCasePosition);
          return { quarterType, position, casePosition: typeCasePosition, caseLabel };
        });
      return { ...application, seniorityPosition: index + 1, casePosition, caseType, caseLabel, typeSeniority };
    })
    .filter((application) => application.submittedByUnitId === unitId);
  return ok(res, { ...counts, seniorityTotal: seniorityQueue.length, seniority });
}));

type Row = Record<string, string | number | boolean | Date | null | undefined>;
async function reportRows(reportType: string, unitId?: string): Promise<Row[]> {
  if (unitId && !["pending-applications", "urgent-applications", "allotment-history"].includes(reportType)) {
    throw new ApiError(403, "Unit users can access application reports for their unit only");
  }
  if (reportType === "quarter-availability") {
    const quarters = await prisma.quarter.findMany({ include: { area: true, quarterType: true } });
    const values = new Map<string, Row>();
    for (const q of quarters) {
      const key = `${q.area.name}|${q.quarterType.name}`;
      const row = values.get(key) ?? { Area: q.area.name, "Quarter Type": q.quarterType.name, Total: 0, Available: 0, Occupied: 0, "Under Repair": 0, Reserved: 0, "Vacated Pending Inspection": 0 };
      row.Total = Number(row.Total) + 1;
      const label: Record<QuarterStatus, string> = {
        AVAILABLE: "Available", OCCUPIED: "Occupied", UNDER_REPAIR: "Under Repair", RESERVED: "Reserved",
        VACATED_PENDING_INSPECTION: "Vacated Pending Inspection", DISPUTED: "Disputed", INACTIVE: "Inactive"
      };
      const name = label[q.status];
      row[name] = Number(row[name] ?? 0) + 1;
      values.set(key, row);
    }
    return [...values.values()];
  }
  if (reportType === "quarter-occupancy") {
    const values = await prisma.occupancyRecord.findMany({ include: { quarter: { include: { area: true, quarterType: true } }, personnel: { include: { designation: true, currentPoliceUnit: true } } } });
    return values.map((r) => ({
      Quarter: r.quarter.fullQuarterCode ?? r.quarter.houseNumber, Area: r.quarter.area.name, Type: r.quarter.quarterType.name,
      Resident: r.personnel.fullName, Designation: r.personnel.designation.code, Buckle: r.personnel.buckleNumber,
      Posting: r.personnel.currentPoliceUnit.name, "Allocated Date": r.allocatedDate, Current: r.isCurrent
    }));
  }
  if (reportType === "duplicate-applications") {
    const values = await prisma.duplicateCheck.findMany({ include: { application: { include: { personnel: true } }, matchedPersonnel: true } });
    return values.map((r) => ({ Application: r.application.applicationNo, Personnel: r.application.personnel.fullName, Reason: r.matchReason, Strength: r.matchStrength, Score: r.matchScore, Matched: r.matchedPersonnel?.fullName ?? "" }));
  }
  if (reportType === "allotment-history") {
    const values = await prisma.allotment.findMany({ where: unitId ? { application: { submittedByUnitId: unitId } } : undefined, include: { application: true, personnel: { include: { designation: true } }, quarter: { include: { area: true, quarterType: true } }, approvedBy: true } });
    return values.map((r) => ({ Order: r.allotmentOrderNo, Application: r.application.applicationNo, Personnel: r.personnel.fullName, Designation: r.personnel.designation.code, Area: r.quarter.area.name, Type: r.quarter.quarterType.name, Date: r.allotmentDate, ApprovedBy: r.approvedBy.fullName }));
  }
  const urgent = reportType === "urgent-applications";
  const statusFilter = reportType === "waitlist" ? { status: ApplicationStatus.APPROVED_WAITLIST } :
    reportType === "application-aging" ? { status: { in: active }, submittedAt: { lte: new Date(Date.now() - 15 * 86400000) } } :
    { status: { in: active } };
  const values = await prisma.application.findMany({ where: { ...(urgent ? { isSpecialCase: true } : statusFilter), submittedByUnitId: unitId }, include: { personnel: { include: { designation: true, currentPoliceUnit: true } }, preferences: { include: { area: true, quarterType: true } } } });
  return values.map((r) => ({
    Application: r.applicationNo, Type: r.applicationType, Personnel: r.personnel.fullName, Designation: r.personnel.designation.code,
    Posting: r.personnel.currentPoliceUnit.name, Preference: r.preferences.map((p) => `${p.area.name}/${p.quarterType.name}`).join(", "),
    Special: r.isSpecialCase, Status: r.status, Submitted: r.submittedAt
  }));
}
const reportTypes = ["quarter-availability", "quarter-occupancy", "pending-applications", "urgent-applications", "waitlist", "duplicate-applications", "allotment-history", "application-aging", "occupancy-duration"];
for (const name of reportTypes) {
  router.get(`/reports/${name}`, asyncHandler(async (req, res) => ok(res, await reportRows(name, req.auth!.role === UserRole.UNIT_USER ? req.auth!.policeUnitId! : undefined))));
}
router.get("/reports/export/:reportType", allow(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const reportType = pathParam(req, "reportType");
  if (!reportTypes.includes(reportType)) throw new ApiError(404, "Report not found");
  const { format } = z.object({ format: z.enum(["pdf", "excel", "csv"]) }).parse(req.query);
  const rows = await reportRows(reportType);
  await audit(req, { action: "REPORT_EXPORT", entityType: "REPORT", newValue: { reportType, format } });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${reportType}.csv"`);
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
    return res.send([columns.map(escape).join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n"));
  }
  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = columns.map((column) => ({ header: column, key: column, width: 22 }));
    rows.forEach((row) => sheet.addRow(row));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${reportType}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${reportType}.pdf"`);
  const doc = new PDFDocument({ margin: 36, layout: "landscape" });
  doc.pipe(res);
  doc.fontSize(16).text(reportType.replaceAll("-", " ").toUpperCase()).moveDown();
  doc.fontSize(8);
  rows.forEach((row) => doc.text(columns.map((column) => `${column}: ${row[column] ?? ""}`).join(" | ")).moveDown(0.4));
  doc.end();
}));

export default router;
