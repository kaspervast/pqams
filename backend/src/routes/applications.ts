import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import {
  ApprovalAction,
  ApplicationStatus,
  ApplicationType,
  AttachmentType,
  DuplicateMatchStrength,
  Prisma,
  QuarterStatus,
  UserRole
} from "@prisma/client";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { audit, notifyRole, notifyUser } from "../lib/activity.js";
import { ApiError, asyncHandler, ok, pathParam } from "../lib/http.js";
import { allow, authenticate, requireChangedPassword } from "../middleware/auth.js";
import { actionForStatus, activeApplicationStatuses, canReadApplication, ensureTransition, seniorityApplicationStatuses } from "../services/workflow.js";

const router = Router();
router.use(authenticate, requireChangedPassword);

const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png"]);
const diskStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const type = String(req.body?.attachmentType ?? "");
    const subdir = type === AttachmentType.APPLICATION_LETTER ? "application-letters" :
      type === AttachmentType.SPECIAL_CASE_DOCUMENT ? "special-case-documents" : "other";
    const date = new Date();
    const destination = join(config.uploadRoot, subdir, String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"));
    mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename(_req, file, cb) {
    cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  }
});
const attachmentUpload = multer({
  storage: diskStorage,
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!allowedMime.has(file.mimetype)) return cb(new ApiError(400, "Only PDF, JPG, JPEG and PNG files are allowed"));
    cb(null, true);
  }
});

const applicationInclude = {
  personnel: { include: { designation: true, currentPoliceUnit: true, occupancies: { where: { isCurrent: true }, include: { quarter: { include: { area: true, quarterType: true } } } } } },
  submittedByUnit: true,
  submittedByUser: { select: { id: true, fullName: true, username: true } },
  currentQuarter: { include: { area: true, quarterType: true } },
  preferences: { include: { area: true, quarterType: true }, orderBy: { preferenceOrder: "asc" as const } },
  attachments: true,
  duplicateChecks: true,
  approvalHistory: { include: { actedBy: { select: { fullName: true, role: true } } }, orderBy: { actedAt: "desc" as const } },
  allotment: { include: { quarter: { include: { area: true, quarterType: true } }, approvedBy: { select: { fullName: true } } } }
};
type ApplicationPayload = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

async function appendSeniority(applications: ApplicationPayload[]) {
  if (!applications.length) return applications.map((application) => ({ ...application, seniority: null }));
  const queue = await prisma.application.findMany({
    where: { status: { in: seniorityApplicationStatuses }, submittedAt: { not: null } },
    include: { preferences: { include: { quarterType: true }, orderBy: { preferenceOrder: "asc" } } },
    orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }, { createdAt: "asc" }]
  });
  const caseCounters = new Map<string, number>();
  const typeCounters = new Map<string, number>();
  const typeCaseCounters = new Map<string, number>();
  const positions = new Map<string, {
    overallPosition: number;
    casePosition: number;
    caseType: "SPECIAL" | "REGULAR";
    caseLabel: string;
    typeSeniority: Array<{ quarterTypeId: string; quarterType: string; position: number; casePosition: number; caseLabel: string }>;
  }>();
  queue.forEach((application, index) => {
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
        return { quarterTypeId, quarterType, position, casePosition: typeCasePosition, caseLabel };
      });
    positions.set(application.id, { overallPosition: index + 1, casePosition, caseType, caseLabel, typeSeniority });
  });
  return applications.map((application) => ({ ...application, seniority: positions.get(application.id) ?? null }));
}

function sortByQueuePosition<T extends ApplicationPayload & { seniority?: { overallPosition: number } | null }>(applications: T[]) {
  return [...applications].sort((left, right) => {
    const leftPosition = left.seniority?.overallPosition ?? Number.POSITIVE_INFINITY;
    const rightPosition = right.seniority?.overallPosition ?? Number.POSITIVE_INFINITY;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

async function assertFirstPendingInStage(applicationId: string, stageStatuses: ApplicationStatus[]) {
  const queue = await prisma.application.findMany({
    where: { status: { in: seniorityApplicationStatuses }, submittedAt: { not: null } },
    select: { id: true, applicationNo: true, status: true, isSpecialCase: true, submittedAt: true, createdAt: true },
    orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }, { createdAt: "asc" }]
  });
  const firstPending = queue.find((application) => stageStatuses.includes(application.status));
  if (firstPending && firstPending.id !== applicationId) {
    throw new ApiError(
      409,
      `Sequential processing required. Clear ${firstPending.applicationNo} (${firstPending.status}) before processing later applications.`
    );
  }
}

const applicantSchema = z.object({
  indexNumber: z.string().trim().min(1),
  buckleNumber: z.string().trim().min(1),
  fullName: z.string().trim().min(2),
  mobileNumber: z.string().trim().min(10).max(20),
  designationId: z.string().uuid(),
  currentAddress: z.string().trim().min(5),
  serviceJoinDate: z.coerce.date(),
  lastPostingOutsideRajkot: z.string().trim().max(200).optional().nullable()
});

const applicationBase = z.object({
  applicationType: z.nativeEnum(ApplicationType),
  applicant: applicantSchema,
  applyingForGroup: z.boolean().default(false),
  groupDetails: z.string().optional().nullable(),
  currentQuarterText: z.string().optional().nullable(),
  reasonForChange: z.string().optional().nullable(),
  isSpecialCase: z.boolean().default(false),
  specialCaseCategory: z.enum(["MEDICAL", "DISABILITY", "WIDOW_COMPASSIONATE", "DISTANCE_FROM_POSTING", "FAMILY_SAFETY", "LAW_AND_ORDER_SENSITIVITY", "GOVERNMENT_DUTY_URGENCY", "EXISTING_QUARTER_UNSAFE", "OTHER"]).optional().nullable(),
  specialCaseReason: z.string().optional().nullable(),
  recommendedByOfficer: z.boolean().default(false),
  recommendingOfficerName: z.string().optional().nullable(),
  recommendingOfficerDesignation: z.string().optional().nullable(),
  preferences: z.array(z.object({
    areaId: z.string().uuid(),
    quarterTypeId: z.string().uuid(),
    preferenceOrder: z.coerce.number().int().min(1).max(3)
  })).min(1).max(3)
});
const applicationSchema = applicationBase.superRefine((input, ctx) => {
  if (input.isSpecialCase && (!input.specialCaseCategory || !input.specialCaseReason?.trim())) {
    ctx.addIssue({ code: "custom", message: "Special case category and reason are required", path: ["specialCaseReason"] });
  }
  if (input.applyingForGroup && !input.groupDetails?.trim()) {
    ctx.addIssue({ code: "custom", message: "Group details are required", path: ["groupDetails"] });
  }
});

async function resolveApplicant(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof applicantSchema>,
  policeUnitId: string,
  actorId: string
) {
  const matches = await tx.personnel.findMany({
    where: { OR: [{ indexNumber: input.indexNumber }, { buckleNumber: input.buckleNumber }] }
  });
  if (new Set(matches.map((personnel) => personnel.id)).size > 1) {
    throw new ApiError(409, "Index number and buckle number match different personnel records. Contact Admin for correction.");
  }
  const data = {
    indexNumber: input.indexNumber,
    buckleNumber: input.buckleNumber,
    fullName: input.fullName,
    mobileNumber: input.mobileNumber,
    designationId: input.designationId,
    currentPoliceUnitId: policeUnitId,
    currentAddress: input.currentAddress,
    serviceJoinDate: input.serviceJoinDate,
    lastPostingOutsideRajkot: input.lastPostingOutsideRajkot || null
  };
  let personnel = matches[0];
  if (personnel && !personnel.isActive) throw new ApiError(409, "The matched personnel record is inactive. Contact Admin before applying.");
  personnel = personnel
    ? await tx.personnel.update({ where: { id: personnel.id }, data: { ...data, updatedById: actorId } })
    : await tx.personnel.create({ data: { ...data, createdById: actorId } });
  const occupancy = await tx.occupancyRecord.findFirst({ where: { personnelId: personnel.id, isCurrent: true } });
  return { personnel, occupancy };
}

function assertAccess(application: { submittedByUnitId: string }) {
  return (req: Request) => {
    if (!canReadApplication(req.auth!.role, req.auth!.policeUnitId, application.submittedByUnitId)) {
      throw new ApiError(403, "Not authorized for this application");
    }
  };
}

async function getApplication(id: string) {
  const application = await prisma.application.findUnique({ where: { id }, include: applicationInclude });
  if (!application) throw new ApiError(404, "Application not found");
  return application;
}

router.get("/applications", asyncHandler(async (req, res) => {
  const query = z.object({
    status: z.nativeEnum(ApplicationStatus).optional(), applicationType: z.nativeEnum(ApplicationType).optional(),
    specialCase: z.enum(["true", "false"]).optional(), q: z.string().optional()
  }).parse(req.query);
  const applications = await prisma.application.findMany({
    where: {
      submittedByUnitId: req.auth!.role === UserRole.UNIT_USER ? req.auth!.policeUnitId! : undefined,
      status: query.status, applicationType: query.applicationType,
      isSpecialCase: query.specialCase ? query.specialCase === "true" : undefined,
      OR: query.q ? [{ applicationNo: { contains: query.q, mode: "insensitive" } }, { personnel: { fullName: { contains: query.q, mode: "insensitive" } } }] : undefined
    },
    include: applicationInclude,
    orderBy: [{ isSpecialCase: "desc" }, { createdAt: "desc" }]
  });
  return ok(res, sortByQueuePosition(await appendSeniority(applications)));
}));
router.get("/applications/pending/admin", allow(UserRole.ADMIN, UserRole.VIEWER), asyncHandler(async (_req, res) => {
  const applications = await prisma.application.findMany({ where: { status: { in: [ApplicationStatus.ADMIN_REVIEW, ApplicationStatus.DUPLICATE_REVIEW] } }, include: applicationInclude, orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }] });
  return ok(res, sortByQueuePosition(await appendSeniority(applications)));
}));
router.get("/applications/pending/correspondence", allow(UserRole.CORRESPONDENCE_BRANCH, UserRole.VIEWER), asyncHandler(async (_req, res) => {
  const applications = await prisma.application.findMany({ where: { status: ApplicationStatus.CORRESPONDENCE_REVIEW }, include: applicationInclude, orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }] });
  return ok(res, sortByQueuePosition(await appendSeniority(applications)));
}));
router.get("/applications/pending/super-admin", allow(UserRole.SUPER_ADMIN, UserRole.VIEWER), asyncHandler(async (_req, res) => {
  const applications = await prisma.application.findMany({ where: { status: { in: [ApplicationStatus.SUPER_ADMIN_REVIEW, ApplicationStatus.APPROVED_PENDING_ALLOTMENT] } }, include: applicationInclude, orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }] });
  return ok(res, sortByQueuePosition(await appendSeniority(applications)));
}));
router.get("/applications/:id", asyncHandler(async (req, res) => {
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  const [withSeniority] = await appendSeniority([application]);
  return ok(res, withSeniority);
}));
router.post("/applications", allow(UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const input = applicationSchema.parse(req.body);
  const application = await prisma.$transaction(async (tx) => {
    const { personnel, occupancy } = await resolveApplicant(tx, input.applicant, req.auth!.policeUnitId!, req.auth!.id);
    const active = await tx.application.findFirst({ where: { personnelId: personnel.id, status: { in: activeApplicationStatuses } } });
    if (active) throw new ApiError(409, `Personnel already has an active application (${active.applicationNo})`);
    const applicationType = input.applicationType;
    if (applicationType === ApplicationType.NEW_ALLOTMENT && occupancy) {
      throw new ApiError(409, "Personnel already occupies a quarter. Select Transfer / Quarter Change.");
    }
    if (applicationType === ApplicationType.TRANSFER_CHANGE && !occupancy) {
      throw new ApiError(409, "Transfer / Quarter Change is available only for personnel currently occupying a quarter.");
    }
    if (applicationType === ApplicationType.TRANSFER_CHANGE && !input.reasonForChange?.trim()) {
      throw new ApiError(400, "Reason for change is required for a transfer/change request");
    }
    const applicationNo = `PQAMS-${new Date().getFullYear()}-${Date.now()}`;
    return tx.application.create({
      data: {
        applicationType,
        personnelId: personnel.id,
        applyingForGroup: input.applyingForGroup,
        groupDetails: input.groupDetails,
        currentQuarterId: occupancy?.quarterId ?? null,
        currentQuarterText: input.currentQuarterText,
        reasonForChange: input.reasonForChange,
        isSpecialCase: input.isSpecialCase,
        specialCaseCategory: input.specialCaseCategory,
        specialCaseReason: input.specialCaseReason,
        recommendedByOfficer: input.recommendedByOfficer,
        recommendingOfficerName: input.recommendingOfficerName,
        recommendingOfficerDesignation: input.recommendingOfficerDesignation,
        preferences: { create: input.preferences },
        submittedByUserId: req.auth!.id,
        submittedByUnitId: req.auth!.policeUnitId!,
        applicationNo
      },
      include: applicationInclude
    });
  });
  await audit(req, { action: "APPLICATION_CREATE", entityType: "APPLICATION", entityId: application.id, newValue: input });
  return ok(res, application, "Draft application created", 201);
}));
router.patch("/applications/:id", allow(UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const input = applicationBase.partial().parse(req.body);
  const existing = await getApplication(pathParam(req));
  assertAccess(existing)(req);
  if (!([ApplicationStatus.DRAFT, ApplicationStatus.RETURNED_FOR_RECONSIDERATION] as ApplicationStatus[]).includes(existing.status)) throw new ApiError(409, "Only draft or returned applications can be changed");
  const application = await prisma.$transaction(async (tx) => {
    if (input.applicant) {
      const conflict = await tx.personnel.findFirst({
        where: {
          id: { not: existing.personnelId },
          OR: [{ indexNumber: input.applicant.indexNumber }, { buckleNumber: input.applicant.buckleNumber }]
        }
      });
      if (conflict) throw new ApiError(409, "Index number or buckle number is already assigned to another personnel record");
      await tx.personnel.update({
        where: { id: existing.personnelId },
        data: {
          ...input.applicant,
          lastPostingOutsideRajkot: input.applicant.lastPostingOutsideRajkot || null,
          currentPoliceUnitId: req.auth!.policeUnitId!,
          updatedById: req.auth!.id
        }
      });
    }
    if (input.preferences) {
      await tx.applicationPreference.deleteMany({ where: { applicationId: existing.id } });
      await tx.applicationPreference.createMany({ data: input.preferences.map((preference) => ({ ...preference, applicationId: existing.id })) });
    }
    const { preferences: _preferences, applicant: _applicant, ...data } = input;
    return tx.application.update({ where: { id: existing.id }, data, include: applicationInclude });
  });
  await audit(req, { action: "APPLICATION_UPDATE", entityType: "APPLICATION", entityId: application.id, newValue: input });
  return ok(res, application, "Application updated");
}));

async function submit(id: string, userId: string) {
  const application = await getApplication(id);
  if (!([ApplicationStatus.DRAFT, ApplicationStatus.RETURNED_FOR_RECONSIDERATION] as ApplicationStatus[]).includes(application.status)) throw new ApiError(409, "Application cannot be submitted in its current status");
  const occupancy = application.personnel.occupancies[0] ?? null;
  if (application.applicationType === ApplicationType.NEW_ALLOTMENT && occupancy) throw new ApiError(409, "Personnel already occupies a quarter and must submit a transfer request");
  if (application.applicationType === ApplicationType.TRANSFER_CHANGE && !occupancy) throw new ApiError(409, "Transfer/change requires a current quarter");
  const otherActive = await prisma.application.findFirst({ where: { personnelId: application.personnelId, id: { not: application.id }, status: { in: activeApplicationStatuses } } });
  if (otherActive) throw new ApiError(409, "Personnel already has an active application");
  if (!application.attachments.some((attachment) => attachment.attachmentType === AttachmentType.APPLICATION_LETTER)) throw new ApiError(400, "Application letter attachment is mandatory");
  if (application.isSpecialCase && !application.attachments.some((attachment) => attachment.attachmentType === AttachmentType.SPECIAL_CASE_DOCUMENT)) throw new ApiError(400, "Special case supporting document is mandatory");
  for (const preference of application.preferences) {
    const rule = await prisma.eligibilityRule.findUnique({ where: { designationId_quarterTypeId: { designationId: application.personnel.designationId, quarterTypeId: preference.quarterTypeId } } });
    if (!rule?.isEligible) throw new ApiError(400, `${preference.quarterType.name} is not eligible for ${application.personnel.designation.code}`);
  }
  const softMatches = await prisma.personnel.findMany({
    where: {
      id: { not: application.personnelId },
      OR: [{ mobileNumber: application.personnel.mobileNumber }, { fullName: { equals: application.personnel.fullName, mode: "insensitive" }, currentPoliceUnitId: application.personnel.currentPoliceUnitId }]
    }
  });
  const targetStatus = softMatches.length ? ApplicationStatus.DUPLICATE_REVIEW : ApplicationStatus.ADMIN_REVIEW;
  return prisma.$transaction(async (tx) => {
    await tx.duplicateCheck.deleteMany({ where: { applicationId: application.id, reviewedAt: null } });
    for (const match of softMatches) {
      const mobileMatch = match.mobileNumber === application.personnel.mobileNumber;
      await tx.duplicateCheck.create({
        data: {
          applicationId: application.id, matchedPersonnelId: match.id,
          matchStrength: mobileMatch ? DuplicateMatchStrength.HIGH : DuplicateMatchStrength.MEDIUM,
          matchScore: mobileMatch ? 70 : 60,
          matchReason: mobileMatch ? "Mobile number matches another personnel record" : "Same name and posting found"
        }
      });
    }
    const firstFrom = application.status;
    ensureTransition(firstFrom, ApplicationStatus.SUBMITTED);
    await tx.approvalHistory.create({ data: { applicationId: id, action: "SUBMITTED", fromStatus: firstFrom, toStatus: ApplicationStatus.SUBMITTED, actedById: userId } });
    ensureTransition(ApplicationStatus.SUBMITTED, targetStatus);
    const updated = await tx.application.update({
      where: { id },
      data: { status: targetStatus, submittedAt: application.submittedAt ?? new Date(), duplicateFlag: softMatches.length > 0, duplicateSummary: softMatches.length ? `${softMatches.length} possible match(es) require review` : null },
      include: applicationInclude
    });
    await tx.approvalHistory.create({ data: { applicationId: id, action: "VERIFIED", fromStatus: ApplicationStatus.SUBMITTED, toStatus: targetStatus, actedById: userId, remarks: softMatches.length ? "Potential duplicate detected" : "Automated validation passed" } });
    return updated;
  });
}
router.post("/applications/:id/submit", allow(UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const current = await getApplication(pathParam(req));
  assertAccess(current)(req);
  const application = await submit(current.id, req.auth!.id);
  await notifyRole(application.status === ApplicationStatus.DUPLICATE_REVIEW ? UserRole.ADMIN : UserRole.ADMIN, "Application awaiting review", `${application.applicationNo} requires Admin action`, application.id);
  await audit(req, { action: "APPLICATION_SUBMIT", entityType: "APPLICATION", entityId: application.id, newValue: { status: application.status } });
  return ok(res, application, "Application submitted");
}));
router.post("/applications/:id/resubmit", allow(UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const current = await getApplication(pathParam(req));
  assertAccess(current)(req);
  const application = await submit(current.id, req.auth!.id);
  await audit(req, { action: "APPLICATION_RESUBMIT", entityType: "APPLICATION", entityId: application.id });
  return ok(res, application, "Application resubmitted");
}));
router.post("/applications/:id/cancel", allow(UserRole.UNIT_USER), asyncHandler(async (req, res) => {
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  ensureTransition(application.status, ApplicationStatus.CANCELLED);
  const updated = await prisma.application.update({ where: { id: application.id }, data: { status: ApplicationStatus.CANCELLED, closedAt: new Date() } });
  await prisma.approvalHistory.create({ data: { applicationId: application.id, action: "CANCELLED", fromStatus: application.status, toStatus: ApplicationStatus.CANCELLED, actedById: req.auth!.id } });
  await audit(req, { action: "APPLICATION_CANCEL", entityType: "APPLICATION", entityId: application.id });
  return ok(res, updated, "Application cancelled");
}));
router.get("/applications/:id/history", asyncHandler(async (req, res) => {
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  return ok(res, application.approvalHistory);
}));
router.get("/applications/:id/duplicates", allow(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER), asyncHandler(async (req, res) => ok(res, await prisma.duplicateCheck.findMany({ where: { applicationId: pathParam(req) }, include: { matchedPersonnel: true, matchedApplication: true } }))));

router.post("/applications/:id/attachments", allow(UserRole.UNIT_USER), attachmentUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "File is required");
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  if (!([ApplicationStatus.DRAFT, ApplicationStatus.RETURNED_FOR_RECONSIDERATION] as ApplicationStatus[]).includes(application.status)) throw new ApiError(409, "Documents can only be added to draft or returned applications");
  const { attachmentType, description } = z.object({ attachmentType: z.nativeEnum(AttachmentType), description: z.string().optional() }).parse(req.body);
  const attachment = await prisma.attachment.create({
    data: {
      applicationId: application.id, uploadedByUserId: req.auth!.id, attachmentType, description,
      originalFileName: req.file.originalname, storedFileName: req.file.filename, filePath: req.file.path,
      mimeType: req.file.mimetype, fileSizeBytes: BigInt(req.file.size)
    }
  });
  await audit(req, { action: "ATTACHMENT_UPLOAD", entityType: "ATTACHMENT", entityId: attachment.id, newValue: { attachmentType, name: req.file.originalname } });
  return ok(res, attachment, "Attachment uploaded", 201);
}));
router.get("/applications/:id/attachments", asyncHandler(async (req, res) => {
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  return ok(res, application.attachments);
}));
router.get("/attachments/:id/download", asyncHandler(async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: pathParam(req) }, include: { application: true } });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  if (req.auth!.role === UserRole.VIEWER) throw new ApiError(403, "Viewer cannot download protected documents");
  assertAccess(attachment.application)(req);
  if (!existsSync(attachment.filePath)) throw new ApiError(404, "Stored file is missing");
  return res.download(attachment.filePath, attachment.originalFileName);
}));
router.patch("/attachments/:id/verify", allow(UserRole.ADMIN, UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const attachment = await prisma.attachment.update({ where: { id: pathParam(req) }, data: { isVerified: true, verifiedById: req.auth!.id, verifiedAt: new Date() } });
  await audit(req, { action: "ATTACHMENT_VERIFY", entityType: "ATTACHMENT", entityId: attachment.id });
  return ok(res, attachment, "Attachment verified");
}));
router.delete("/attachments/:id", allow(UserRole.UNIT_USER, UserRole.ADMIN), asyncHandler(async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: pathParam(req) }, include: { application: true } });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  if (req.auth!.role === UserRole.UNIT_USER) assertAccess(attachment.application)(req);
  if (!([ApplicationStatus.DRAFT, ApplicationStatus.RETURNED_FOR_RECONSIDERATION] as ApplicationStatus[]).includes(attachment.application.status)) throw new ApiError(409, "Attachment cannot be removed after submission");
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await audit(req, { action: "ATTACHMENT_DELETE", entityType: "ATTACHMENT", entityId: attachment.id });
  return ok(res, null, "Attachment removed");
}));

async function transition(req: Request, id: string, from: ApplicationStatus[], to: ApplicationStatus, remarks?: string) {
  const application = await prisma.application.findUniqueOrThrow({ where: { id } });
  if (!from.includes(application.status)) throw new ApiError(409, `Application is not pending this action (${application.status})`);
  await assertFirstPendingInStage(id, from);
  ensureTransition(application.status, to);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id }, data: {
        status: to,
        adminRemarks: req.auth!.role === UserRole.ADMIN ? remarks : undefined,
        correspondenceRemarks: req.auth!.role === UserRole.CORRESPONDENCE_BRANCH ? remarks : undefined,
        superAdminRemarks: req.auth!.role === UserRole.SUPER_ADMIN ? remarks : undefined,
        closedAt: to === ApplicationStatus.REJECTED ? new Date() : undefined
      }
    });
    await tx.approvalHistory.create({ data: { applicationId: id, action: actionForStatus(to), fromStatus: application.status, toStatus: to, remarks, actedById: req.auth!.id } });
    return updated;
  });
}
const remarksSchema = z.object({ action: z.string().optional(), remarks: z.string().optional() });
router.post("/applications/:id/special-case/reject", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { remarks } = remarksSchema.parse(req.body);
  const id = pathParam(req);
  const current = await prisma.application.findUniqueOrThrow({ where: { id } });
  if (!([ApplicationStatus.ADMIN_REVIEW, ApplicationStatus.DUPLICATE_REVIEW] as ApplicationStatus[]).includes(current.status)) {
    throw new ApiError(409, `Special-case priority cannot be reviewed while application is ${current.status}`);
  }
  if (!current.isSpecialCase) throw new ApiError(409, "Application is already in the regular seniority queue");
  await assertFirstPendingInStage(id, [ApplicationStatus.ADMIN_REVIEW, ApplicationStatus.DUPLICATE_REVIEW]);
  const updated = await prisma.$transaction(async (tx) => {
    const regularApplication = await tx.application.update({
      where: { id },
      data: {
        isSpecialCase: false,
        specialCaseCategory: null,
        specialCaseReason: null,
        adminRemarks: remarks
      }
    });
    await tx.approvalHistory.create({
      data: {
        applicationId: id,
        action: ApprovalAction.SPECIAL_CASE_REJECTED,
        fromStatus: current.status,
        toStatus: current.status,
        remarks: remarks ?? "Special-case priority declined; application retained in regular seniority queue",
        actedById: req.auth!.id
      }
    });
    return regularApplication;
  });
  await notifyUser(updated.submittedByUserId, "Special-case priority declined", `${updated.applicationNo} continues in the regular seniority queue`, updated.id);
  await audit(req, {
    action: "SPECIAL_CASE_PRIORITY_REJECT",
    entityType: "APPLICATION",
    entityId: updated.id,
    oldValue: { isSpecialCase: true, category: current.specialCaseCategory, reason: current.specialCaseReason },
    newValue: { isSpecialCase: false, status: updated.status }
  });
  return ok(res, updated, "Special-case priority declined; application moved to regular seniority");
}));
router.post("/applications/:id/admin-review", allow(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { action, remarks } = remarksSchema.parse(req.body);
  const current = await prisma.application.findUniqueOrThrow({ where: { id: pathParam(req) } });
  const to = action === "REJECT" ? ApplicationStatus.REJECTED :
    action === "RETURN" ? ApplicationStatus.RETURNED_FOR_RECONSIDERATION :
    current.status === ApplicationStatus.DUPLICATE_REVIEW ? ApplicationStatus.ADMIN_REVIEW :
    ApplicationStatus.CORRESPONDENCE_REVIEW;
  const updated = await transition(req, pathParam(req), [ApplicationStatus.ADMIN_REVIEW, ApplicationStatus.DUPLICATE_REVIEW], to, remarks);
  if (current.status === ApplicationStatus.DUPLICATE_REVIEW) {
    await prisma.duplicateCheck.updateMany({
      where: { applicationId: current.id, reviewedAt: null },
      data: { reviewedById: req.auth!.id, reviewedAt: new Date(), isConfirmedDuplicate: to === ApplicationStatus.REJECTED, reviewRemarks: remarks }
    });
  }
  if (to === ApplicationStatus.CORRESPONDENCE_REVIEW) await notifyRole(UserRole.CORRESPONDENCE_BRANCH, "Application verification required", `${updated.applicationNo} awaits correspondence verification`, updated.id);
  await audit(req, { action: "ADMIN_REVIEW", entityType: "APPLICATION", entityId: updated.id, newValue: { status: to } });
  return ok(res, updated, "Admin review recorded");
}));
router.post("/applications/:id/correspondence-review", allow(UserRole.CORRESPONDENCE_BRANCH), asyncHandler(async (req, res) => {
  const { action, remarks } = remarksSchema.parse(req.body);
  const to = action === "RETURN" ? ApplicationStatus.RETURNED_FOR_RECONSIDERATION : ApplicationStatus.SUPER_ADMIN_REVIEW;
  const updated = await transition(req, pathParam(req), [ApplicationStatus.CORRESPONDENCE_REVIEW], to, remarks);
  if (to === ApplicationStatus.SUPER_ADMIN_REVIEW) await notifyRole(UserRole.SUPER_ADMIN, "Final review required", `${updated.applicationNo} awaits final decision`, updated.id);
  await audit(req, { action: "CORRESPONDENCE_REVIEW", entityType: "APPLICATION", entityId: updated.id, newValue: { status: to } });
  return ok(res, updated, "Correspondence review recorded");
}));
for (const [path, status, message] of [
  ["return", ApplicationStatus.RETURNED_FOR_RECONSIDERATION, "Application returned"],
  ["reject", ApplicationStatus.REJECTED, "Application rejected"],
  ["approve-waitlist", ApplicationStatus.APPROVED_WAITLIST, "Application waitlisted"],
  ["approve-pending-allotment", ApplicationStatus.APPROVED_PENDING_ALLOTMENT, "Application approved for allotment"]
] as const) {
  router.post(`/applications/:id/super-admin/${path}`, allow(UserRole.SUPER_ADMIN), asyncHandler(async (req, res) => {
    const { remarks } = remarksSchema.parse(req.body);
    const updated = await transition(req, pathParam(req), [ApplicationStatus.SUPER_ADMIN_REVIEW], status, remarks);
    const source = await prisma.application.findUniqueOrThrow({ where: { id: updated.id } });
    await notifyUser(source.submittedByUserId, message, `${source.applicationNo}: ${message}`, source.id);
    await audit(req, { action: `SUPER_ADMIN_${path.toUpperCase()}`, entityType: "APPLICATION", entityId: updated.id, newValue: { status } });
    return ok(res, updated, message);
  }));
}
const allotSchema = z.object({ quarterId: z.string().uuid(), allotmentDate: z.coerce.date(), possessionDueDate: z.coerce.date().optional().nullable(), remarks: z.string().optional() });
router.post("/applications/:id/super-admin/allot", allow(UserRole.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const input = allotSchema.parse(req.body);
  const applicationId = pathParam(req);
  await assertFirstPendingInStage(applicationId, [ApplicationStatus.APPROVED_PENDING_ALLOTMENT]);
  const application = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM applications WHERE id = ${applicationId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM quarters WHERE id = ${input.quarterId}::uuid FOR UPDATE`;
    const current = await tx.application.findUniqueOrThrow({ where: { id: applicationId }, include: { preferences: true, personnel: true } });
    if (current.status !== ApplicationStatus.APPROVED_PENDING_ALLOTMENT) throw new ApiError(409, "Application must be approved pending allotment first");
    const quarter = await tx.quarter.findUniqueOrThrow({ where: { id: input.quarterId } });
    if (quarter.status !== QuarterStatus.AVAILABLE || !quarter.approvedByAdmin) throw new ApiError(409, "Quarter is not available for allotment");
    if (!current.preferences.some((preference) => preference.quarterTypeId === quarter.quarterTypeId)) {
      throw new ApiError(400, "Selected quarter type was not requested in this application");
    }
    const eligible = await tx.eligibilityRule.findUnique({ where: { designationId_quarterTypeId: { designationId: current.personnel.designationId, quarterTypeId: quarter.quarterTypeId } } });
    if (!eligible?.isEligible) throw new ApiError(400, "Selected quarter type is not eligible for this personnel");
    const seniorApplication = await tx.application.findFirst({
      where: {
        status: { in: seniorityApplicationStatuses },
        submittedAt: { not: null },
        preferences: { some: { quarterTypeId: quarter.quarterTypeId } },
        personnel: { designation: { eligibilityRules: { some: { quarterTypeId: quarter.quarterTypeId, isEligible: true } } } }
      },
      select: { id: true, applicationNo: true, isSpecialCase: true, submittedAt: true },
      orderBy: [{ isSpecialCase: "desc" }, { submittedAt: "asc" }, { createdAt: "asc" }]
    });
    if (seniorApplication && seniorApplication.id !== current.id) {
      throw new ApiError(409, `Allotment must follow seniority. ${seniorApplication.applicationNo} has priority for this quarter type.`);
    }
    const previousOccupancy = await tx.occupancyRecord.findFirst({ where: { personnelId: current.personnelId, isCurrent: true } });
    if (current.applicationType === ApplicationType.TRANSFER_CHANGE && previousOccupancy) {
      await tx.occupancyRecord.update({ where: { id: previousOccupancy.id }, data: { isCurrent: false, vacatedDate: input.allotmentDate, closedById: req.auth!.id } });
      await tx.quarter.update({ where: { id: previousOccupancy.quarterId }, data: { status: QuarterStatus.VACATED_PENDING_INSPECTION } });
      await tx.quarterStatusHistory.create({ data: { quarterId: previousOccupancy.quarterId, oldStatus: QuarterStatus.OCCUPIED, newStatus: QuarterStatus.VACATED_PENDING_INSPECTION, reason: "Transfer allotment completed", changedById: req.auth!.id } });
    }
    await tx.quarter.update({ where: { id: quarter.id }, data: { status: QuarterStatus.OCCUPIED, updatedById: req.auth!.id } });
    await tx.quarterStatusHistory.create({ data: { quarterId: quarter.id, oldStatus: QuarterStatus.AVAILABLE, newStatus: QuarterStatus.OCCUPIED, reason: "Super Admin allotment", changedById: req.auth!.id } });
    await tx.occupancyRecord.create({ data: { personnelId: current.personnelId, quarterId: quarter.id, allocatedDate: input.allotmentDate, isCurrent: true, createdById: req.auth!.id } });
    const orderNo = `PQAMS/ALLOT/${new Date().getFullYear()}/${Date.now()}`;
    await tx.allotment.create({
      data: { applicationId: current.id, personnelId: current.personnelId, quarterId: quarter.id, previousQuarterId: previousOccupancy?.quarterId, allotmentOrderNo: orderNo, allotmentDate: input.allotmentDate, possessionDueDate: input.possessionDueDate, remarks: input.remarks, approvedById: req.auth!.id }
    });
    ensureTransition(current.status, ApplicationStatus.CLOSED);
    const closed = await tx.application.update({ where: { id: current.id }, data: { status: ApplicationStatus.CLOSED, closedAt: new Date() }, include: applicationInclude });
    await tx.approvalHistory.create({ data: { applicationId: current.id, action: "ALLOTTED", fromStatus: current.status, toStatus: ApplicationStatus.CLOSED, remarks: input.remarks, actedById: req.auth!.id } });
    return closed;
  }, { isolationLevel: "Serializable" });
  await notifyUser(application.submittedByUserId, "Quarter allotted", `${application.applicationNo} has been allotted a quarter`, application.id);
  await audit(req, { action: "QUARTER_ALLOT", entityType: "APPLICATION", entityId: application.id, newValue: input });
  return ok(res, application, "Quarter allotted and application closed");
}));

function renderDocument(res: Response, title: string, lines: string[], filename: string) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.fontSize(18).text(title, { align: "center" }).moveDown();
  doc.fontSize(11);
  for (const line of lines) doc.text(line).moveDown(0.45);
  doc.moveDown().fontSize(9).text("Generated by Police Quarter Allocation Management System");
  doc.end();
}
router.get("/applications/:id/allotment-order/pdf", asyncHandler(async (req, res) => {
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  if (!application.allotment) throw new ApiError(404, "No allotment order exists");
  if (req.auth!.role === UserRole.VIEWER) throw new ApiError(403, "Viewer cannot download protected documents");
  const a = application.allotment;
  renderDocument(res, "Police Quarter Allotment Order", [
    `Order No: ${a.allotmentOrderNo}`, `Date: ${a.createdAt.toLocaleDateString()}`,
    `Applicant: ${application.personnel.fullName} (${application.personnel.designation.name})`,
    `Index / Buckle No: ${application.personnel.indexNumber} / ${application.personnel.buckleNumber}`,
    `Service Join Date: ${application.personnel.serviceJoinDate?.toLocaleDateString() ?? "Not recorded"}`,
    `Last Posting Outside Rajkot: ${application.personnel.lastPostingOutsideRajkot ?? "Not applicable"}`,
    `Posting: ${application.personnel.currentPoliceUnit.name}`,
    `Quarter: ${a.quarter.area.name} - ${a.quarter.quarterType.name} - ${a.quarter.houseNumber}`,
    `Allotment Date: ${a.allotmentDate.toLocaleDateString()}`,
    `Possession Due Date: ${a.possessionDueDate?.toLocaleDateString() ?? "Not specified"}`,
    `Approving Authority: ${a.approvedBy.fullName}`,
    `Remarks: ${a.remarks ?? "None"}`,
    "Terms: Occupation remains subject to departmental residential quarter rules and lawful directions."
  ], `${a.allotmentOrderNo?.replaceAll("/", "-") ?? "allotment-order"}.pdf`);
}));
router.get("/applications/:id/acknowledgement/pdf", asyncHandler(async (req, res) => {
  const application = await getApplication(pathParam(req));
  assertAccess(application)(req);
  if (req.auth!.role === UserRole.VIEWER) throw new ApiError(403, "Viewer cannot download protected documents");
  renderDocument(res, "Quarter Application Acknowledgement", [
    `Application No: ${application.applicationNo}`, `Applicant: ${application.personnel.fullName}`,
    `Index / Buckle No: ${application.personnel.indexNumber} / ${application.personnel.buckleNumber}`,
    `Service Join Date: ${application.personnel.serviceJoinDate?.toLocaleDateString() ?? "Not recorded"}`,
    `Last Posting Outside Rajkot: ${application.personnel.lastPostingOutsideRajkot ?? "Not applicable"}`,
    `Application Type: ${application.applicationType}`, `Status: ${application.status}`,
    `Submitted Date: ${application.submittedAt?.toLocaleDateString() ?? "Draft"}`
  ], `${application.applicationNo}-acknowledgement.pdf`);
}));

export default router;
