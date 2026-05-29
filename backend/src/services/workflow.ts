import { ApplicationStatus, ApprovalAction, type UserRole } from "@prisma/client";
import { ApiError } from "../lib/http.js";

const allowedTransitions: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  DRAFT: [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED],
  SUBMITTED: [ApplicationStatus.DUPLICATE_REVIEW, ApplicationStatus.ADMIN_REVIEW, ApplicationStatus.CANCELLED],
  DUPLICATE_REVIEW: [ApplicationStatus.ADMIN_REVIEW, ApplicationStatus.REJECTED],
  ADMIN_REVIEW: [ApplicationStatus.CORRESPONDENCE_REVIEW, ApplicationStatus.RETURNED_FOR_RECONSIDERATION, ApplicationStatus.REJECTED],
  CORRESPONDENCE_REVIEW: [ApplicationStatus.SUPER_ADMIN_REVIEW, ApplicationStatus.RETURNED_FOR_RECONSIDERATION],
  SUPER_ADMIN_REVIEW: [
    ApplicationStatus.RETURNED_FOR_RECONSIDERATION,
    ApplicationStatus.REJECTED,
    ApplicationStatus.APPROVED_WAITLIST,
    ApplicationStatus.APPROVED_PENDING_ALLOTMENT
  ],
  APPROVED_PENDING_ALLOTMENT: [ApplicationStatus.CLOSED],
  RETURNED_FOR_RECONSIDERATION: [ApplicationStatus.SUBMITTED]
};

export function ensureTransition(from: ApplicationStatus, to: ApplicationStatus) {
  if (!allowedTransitions[from]?.includes(to)) {
    throw new ApiError(409, `Status cannot change from ${from} to ${to}`);
  }
}

export function actionForStatus(status: ApplicationStatus): ApprovalAction {
  const actions: Partial<Record<ApplicationStatus, ApprovalAction>> = {
    SUBMITTED: ApprovalAction.SUBMITTED,
    CORRESPONDENCE_REVIEW: ApprovalAction.VERIFIED,
    SUPER_ADMIN_REVIEW: ApprovalAction.VERIFIED,
    RETURNED_FOR_RECONSIDERATION: ApprovalAction.RETURNED,
    REJECTED: ApprovalAction.REJECTED,
    APPROVED_WAITLIST: ApprovalAction.APPROVED_WAITLIST,
    APPROVED_PENDING_ALLOTMENT: ApprovalAction.APPROVED_PENDING_ALLOTMENT,
    CANCELLED: ApprovalAction.CANCELLED,
    CLOSED: ApprovalAction.CLOSED
  };
  return actions[status] ?? ApprovalAction.VERIFIED;
}

export const activeApplicationStatuses: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.DUPLICATE_REVIEW,
  ApplicationStatus.ADMIN_REVIEW,
  ApplicationStatus.CORRESPONDENCE_REVIEW,
  ApplicationStatus.SUPER_ADMIN_REVIEW,
  ApplicationStatus.RETURNED_FOR_RECONSIDERATION,
  ApplicationStatus.APPROVED_WAITLIST,
  ApplicationStatus.APPROVED_PENDING_ALLOTMENT
];

export const seniorityApplicationStatuses: ApplicationStatus[] = activeApplicationStatuses.filter(
  (status) => status !== ApplicationStatus.DRAFT
);

export function canReadApplication(role: UserRole, userUnitId: string | null, applicationUnitId: string) {
  return role !== "UNIT_USER" || userUnitId === applicationUnitId;
}
