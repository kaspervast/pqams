-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CORRESPONDENCE_BRANCH', 'UNIT_USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "unit_type" AS ENUM ('POLICE_STATION', 'BRANCH', 'HEADQUARTER', 'OTHER');

-- CreateEnum
CREATE TYPE "quarter_status" AS ENUM ('AVAILABLE', 'OCCUPIED', 'UNDER_REPAIR', 'RESERVED', 'VACATED_PENDING_INSPECTION', 'DISPUTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "application_type" AS ENUM ('NEW_ALLOTMENT', 'TRANSFER_CHANGE');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('DRAFT', 'SUBMITTED', 'DUPLICATE_REVIEW', 'ADMIN_REVIEW', 'CORRESPONDENCE_REVIEW', 'SUPER_ADMIN_REVIEW', 'RETURNED_FOR_RECONSIDERATION', 'APPROVED_WAITLIST', 'APPROVED_PENDING_ALLOTMENT', 'ALLOTTED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "urgency_category" AS ENUM ('MEDICAL', 'DISABILITY', 'WIDOW_COMPASSIONATE', 'DISTANCE_FROM_POSTING', 'FAMILY_SAFETY', 'LAW_AND_ORDER_SENSITIVITY', 'GOVERNMENT_DUTY_URGENCY', 'EXISTING_QUARTER_UNSAFE', 'OTHER');

-- CreateEnum
CREATE TYPE "attachment_type" AS ENUM ('APPLICATION_LETTER', 'SPECIAL_CASE_DOCUMENT', 'ID_PROOF', 'CURRENT_QUARTER_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "approval_action" AS ENUM ('SUBMITTED', 'VERIFIED', 'RETURNED', 'REJECTED', 'APPROVED_WAITLIST', 'APPROVED_PENDING_ALLOTMENT', 'ALLOTTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "duplicate_match_strength" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXACT');

-- CreateEnum
CREATE TYPE "change_request_type" AS ENUM ('CREATE_QUARTER', 'UPDATE_QUARTER', 'STATUS_CHANGE', 'BULK_IMPORT');

-- CreateEnum
CREATE TYPE "change_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "police_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "unit_type" "unit_type" NOT NULL,
    "address" TEXT,
    "contact_number" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "police_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(150) NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "police_unit_id" UUID,
    "mobile_number" VARCHAR(20),
    "email" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rank_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarter_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarter_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "designation_id" UUID NOT NULL,
    "quarter_type_id" UUID NOT NULL,
    "is_eligible" BOOLEAN NOT NULL DEFAULT false,
    "requires_special_approval" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "area_id" UUID NOT NULL,
    "quarter_type_id" UUID NOT NULL,
    "wing" VARCHAR(50),
    "block" VARCHAR(50),
    "floor" VARCHAR(50),
    "house_number" VARCHAR(80) NOT NULL,
    "full_quarter_code" VARCHAR(150),
    "status" "quarter_status" NOT NULL DEFAULT 'AVAILABLE',
    "condition_remarks" TEXT,
    "electricity_meter_no" VARCHAR(100),
    "water_connection_no" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "approved_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "admin_approved_by" UUID,
    "admin_approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "index_number" VARCHAR(80) NOT NULL,
    "buckle_number" VARCHAR(80) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "mobile_number" VARCHAR(20) NOT NULL,
    "designation_id" UUID NOT NULL,
    "current_police_unit_id" UUID NOT NULL,
    "current_address" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupancy_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personnel_id" UUID NOT NULL,
    "quarter_id" UUID NOT NULL,
    "allocated_date" DATE NOT NULL,
    "possession_date" DATE,
    "vacated_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "allocation_reference_no" VARCHAR(100),
    "remarks" TEXT,
    "created_by" UUID,
    "closed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occupancy_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_no" VARCHAR(100) NOT NULL,
    "application_type" "application_type" NOT NULL,
    "personnel_id" UUID NOT NULL,
    "submitted_by_user_id" UUID NOT NULL,
    "submitted_by_unit_id" UUID NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'DRAFT',
    "applying_for_group" BOOLEAN NOT NULL DEFAULT false,
    "group_details" TEXT,
    "current_quarter_id" UUID,
    "current_quarter_text" TEXT,
    "reason_for_change" TEXT,
    "is_special_case" BOOLEAN NOT NULL DEFAULT false,
    "special_case_category" "urgency_category",
    "special_case_reason" TEXT,
    "recommended_by_officer" BOOLEAN NOT NULL DEFAULT false,
    "recommending_officer_name" VARCHAR(150),
    "recommending_officer_designation" VARCHAR(100),
    "duplicate_flag" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_summary" TEXT,
    "admin_remarks" TEXT,
    "correspondence_remarks" TEXT,
    "super_admin_remarks" TEXT,
    "submitted_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "quarter_type_id" UUID NOT NULL,
    "preference_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "attachment_type" "attachment_type" NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "stored_file_name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "description" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "matched_personnel_id" UUID,
    "matched_application_id" UUID,
    "match_strength" "duplicate_match_strength" NOT NULL,
    "match_reason" TEXT NOT NULL,
    "match_score" INTEGER NOT NULL DEFAULT 0,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "is_confirmed_duplicate" BOOLEAN,
    "review_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "action" "approval_action" NOT NULL,
    "from_status" "application_status",
    "to_status" "application_status",
    "remarks" TEXT,
    "acted_by" UUID NOT NULL,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allotments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "quarter_id" UUID NOT NULL,
    "previous_quarter_id" UUID,
    "allotment_order_no" VARCHAR(100),
    "allotment_date" DATE NOT NULL,
    "possession_due_date" DATE,
    "remarks" TEXT,
    "approved_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allotments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarter_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quarter_id" UUID NOT NULL,
    "old_status" "quarter_status",
    "new_status" "quarter_status" NOT NULL,
    "reason" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quarter_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "user_role" "user_role",
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(80),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "application_id" UUID,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarter_change_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_type" "change_request_type" NOT NULL,
    "quarter_id" UUID,
    "payload" JSONB NOT NULL,
    "status" "change_request_status" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "created_by" UUID NOT NULL,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quarter_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "police_units_name_key" ON "police_units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "designations_code_key" ON "designations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "quarter_types_name_key" ON "quarter_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "areas_name_key" ON "areas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_rules_designation_id_quarter_type_id_key" ON "eligibility_rules"("designation_id", "quarter_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "quarters_full_quarter_code_key" ON "quarters"("full_quarter_code");

-- CreateIndex
CREATE INDEX "quarters_status_area_id_quarter_type_id_idx" ON "quarters"("status", "area_id", "quarter_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "quarters_area_id_quarter_type_id_wing_block_floor_house_num_key" ON "quarters"("area_id", "quarter_type_id", "wing", "block", "floor", "house_number");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_index_number_key" ON "personnel"("index_number");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_buckle_number_key" ON "personnel"("buckle_number");

-- CreateIndex
CREATE INDEX "personnel_full_name_mobile_number_idx" ON "personnel"("full_name", "mobile_number");

-- CreateIndex
CREATE INDEX "occupancy_records_personnel_id_is_current_idx" ON "occupancy_records"("personnel_id", "is_current");

-- CreateIndex
CREATE INDEX "occupancy_records_quarter_id_is_current_idx" ON "occupancy_records"("quarter_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_no_key" ON "applications"("application_no");

-- CreateIndex
CREATE INDEX "applications_status_submitted_at_idx" ON "applications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "applications_personnel_id_status_idx" ON "applications"("personnel_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "application_preferences_application_id_preference_order_key" ON "application_preferences"("application_id", "preference_order");

-- CreateIndex
CREATE UNIQUE INDEX "allotments_application_id_key" ON "allotments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "allotments_allotment_order_no_key" ON "allotments"("allotment_order_no");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "quarter_change_requests_status_created_at_idx" ON "quarter_change_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_police_unit_id_fkey" FOREIGN KEY ("police_unit_id") REFERENCES "police_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_quarter_type_id_fkey" FOREIGN KEY ("quarter_type_id") REFERENCES "quarter_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarters" ADD CONSTRAINT "quarters_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarters" ADD CONSTRAINT "quarters_quarter_type_id_fkey" FOREIGN KEY ("quarter_type_id") REFERENCES "quarter_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarters" ADD CONSTRAINT "quarters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarters" ADD CONSTRAINT "quarters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarters" ADD CONSTRAINT "quarters_admin_approved_by_fkey" FOREIGN KEY ("admin_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_current_police_unit_id_fkey" FOREIGN KEY ("current_police_unit_id") REFERENCES "police_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_records" ADD CONSTRAINT "occupancy_records_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_records" ADD CONSTRAINT "occupancy_records_quarter_id_fkey" FOREIGN KEY ("quarter_id") REFERENCES "quarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_records" ADD CONSTRAINT "occupancy_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_records" ADD CONSTRAINT "occupancy_records_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_submitted_by_unit_id_fkey" FOREIGN KEY ("submitted_by_unit_id") REFERENCES "police_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_current_quarter_id_fkey" FOREIGN KEY ("current_quarter_id") REFERENCES "quarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_preferences" ADD CONSTRAINT "application_preferences_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_preferences" ADD CONSTRAINT "application_preferences_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_preferences" ADD CONSTRAINT "application_preferences_quarter_type_id_fkey" FOREIGN KEY ("quarter_type_id") REFERENCES "quarter_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_checks" ADD CONSTRAINT "duplicate_checks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_checks" ADD CONSTRAINT "duplicate_checks_matched_personnel_id_fkey" FOREIGN KEY ("matched_personnel_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_checks" ADD CONSTRAINT "duplicate_checks_matched_application_id_fkey" FOREIGN KEY ("matched_application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_checks" ADD CONSTRAINT "duplicate_checks_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_acted_by_fkey" FOREIGN KEY ("acted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allotments" ADD CONSTRAINT "allotments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allotments" ADD CONSTRAINT "allotments_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allotments" ADD CONSTRAINT "allotments_quarter_id_fkey" FOREIGN KEY ("quarter_id") REFERENCES "quarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allotments" ADD CONSTRAINT "allotments_previous_quarter_id_fkey" FOREIGN KEY ("previous_quarter_id") REFERENCES "quarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allotments" ADD CONSTRAINT "allotments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_status_history" ADD CONSTRAINT "quarter_status_history_quarter_id_fkey" FOREIGN KEY ("quarter_id") REFERENCES "quarters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_status_history" ADD CONSTRAINT "quarter_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_change_requests" ADD CONSTRAINT "quarter_change_requests_quarter_id_fkey" FOREIGN KEY ("quarter_id") REFERENCES "quarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_change_requests" ADD CONSTRAINT "quarter_change_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_change_requests" ADD CONSTRAINT "quarter_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business rules requiring PostgreSQL features not represented by Prisma.
DROP INDEX "quarters_area_id_quarter_type_id_wing_block_floor_house_num_key";
CREATE UNIQUE INDEX "ux_quarter_location_unique"
ON "quarters" ("area_id", "quarter_type_id", "wing", "block", "floor", "house_number") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "ux_one_current_quarter_per_person"
ON "occupancy_records" ("personnel_id")
WHERE "is_current" = true;

CREATE UNIQUE INDEX "ux_one_current_person_per_quarter"
ON "occupancy_records" ("quarter_id")
WHERE "is_current" = true;

CREATE UNIQUE INDEX "ux_one_active_application_per_person"
ON "applications" ("personnel_id")
WHERE "status" IN (
  'DRAFT',
  'SUBMITTED',
  'DUPLICATE_REVIEW',
  'ADMIN_REVIEW',
  'CORRESPONDENCE_REVIEW',
  'SUPER_ADMIN_REVIEW',
  'RETURNED_FOR_RECONSIDERATION',
  'APPROVED_WAITLIST',
  'APPROVED_PENDING_ALLOTMENT'
);

ALTER TABLE "application_preferences"
ADD CONSTRAINT "chk_preference_order" CHECK ("preference_order" BETWEEN 1 AND 3);

ALTER TABLE "applications"
ADD CONSTRAINT "chk_transfer_reason" CHECK (
  "application_type" <> 'TRANSFER_CHANGE'
  OR NULLIF(BTRIM("reason_for_change"), '') IS NOT NULL
);

ALTER TABLE "applications"
ADD CONSTRAINT "chk_special_case_details" CHECK (
  "is_special_case" = false
  OR (
    "special_case_category" IS NOT NULL
    AND NULLIF(BTRIM("special_case_reason"), '') IS NOT NULL
  )
);
