import type { Request } from "express";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../prisma.js";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  userId?: string | null;
  userRole?: UserRole | null;
};

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function audit(req: Request | null, input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValue: jsonValue(input.oldValue),
      newValue: jsonValue(input.newValue),
      userId: input.userId ?? req?.auth?.id ?? null,
      userRole: input.userRole ?? req?.auth?.role ?? null,
      ipAddress: req?.ip ?? null,
      userAgent: req?.get("user-agent") ?? null
    }
  });
}

export async function notifyRole(role: UserRole, title: string, message: string, applicationId?: string) {
  const recipients = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
  if (!recipients.length) return;
  await prisma.notification.createMany({
    data: recipients.map(({ id }) => ({ userId: id, title, message, applicationId }))
  });
}

export async function notifyUser(userId: string, title: string, message: string, applicationId?: string) {
  await prisma.notification.create({ data: { userId, title, message, applicationId } });
}

