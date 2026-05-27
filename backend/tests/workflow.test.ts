import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "@prisma/client";
import { ApiError } from "../src/lib/http.js";
import { activeApplicationStatuses, canReadApplication, ensureTransition } from "../src/services/workflow.js";

describe("application workflow rules", () => {
  it("permits only defined review and allotment transitions", () => {
    expect(() => ensureTransition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED)).not.toThrow();
    expect(() => ensureTransition(ApplicationStatus.SUPER_ADMIN_REVIEW, ApplicationStatus.APPROVED_PENDING_ALLOTMENT)).not.toThrow();
    expect(() => ensureTransition(ApplicationStatus.APPROVED_PENDING_ALLOTMENT, ApplicationStatus.CLOSED)).not.toThrow();
  });

  it("blocks arbitrary allocation and terminal status changes", () => {
    expect(() => ensureTransition(ApplicationStatus.DRAFT, ApplicationStatus.CLOSED)).toThrow(ApiError);
    expect(() => ensureTransition(ApplicationStatus.REJECTED, ApplicationStatus.SUBMITTED)).toThrow(ApiError);
  });

  it("retains returned applications in active duplicate prevention scope", () => {
    expect(activeApplicationStatuses).toContain(ApplicationStatus.RETURNED_FOR_RECONSIDERATION);
    expect(activeApplicationStatuses).not.toContain(ApplicationStatus.CLOSED);
  });

  it("limits unit users to their own unit applications", () => {
    expect(canReadApplication("UNIT_USER", "unit-a", "unit-a")).toBe(true);
    expect(canReadApplication("UNIT_USER", "unit-a", "unit-b")).toBe(false);
    expect(canReadApplication("ADMIN", null, "unit-b")).toBe(true);
  });
});
