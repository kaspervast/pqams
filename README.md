# Police Quarter Allocation Management System (PQAMS)

PQAMS is a role-based web application for managing police residential quarter
inventory, allotment applications, verification, final allocation, occupancy,
and operational reporting.

The application runs on one public port:

```text
http://localhost:3120
```

All backend endpoints are exposed below `/api`. In development, Express mounts
Vite middleware on the same port. In production, Express serves the built React
frontend.

## Contents

- [Technology Stack](#technology-stack)
- [Implemented Scope](#implemented-scope)
- [Role Access](#role-access)
- [Application Workflow](#application-workflow)
- [Local Setup](#local-setup)
- [Configuration](#configuration)
- [Seed Data](#seed-data)
- [File Uploads and Import](#file-uploads-and-import)
- [API Reference](#api-reference)
- [Database Overview](#database-overview)
- [Database Enums](#database-enums)
- [Database Table Dictionary](#database-table-dictionary)
- [Database Constraints and Indexes](#database-constraints-and-indexes)
- [Project Structure](#project-structure)
- [Commands and Validation](#commands-and-validation)
- [Security Notes](#security-notes)

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Material UI, React Router, TanStack Query, Axios |
| Backend | Node.js, Express, TypeScript, Zod, Pino |
| Authentication | bcrypt password hashing, JWT access tokens, rotating refresh-cookie sessions |
| Database | PostgreSQL with Prisma ORM and SQL migration constraints |
| Documents | Multer private uploads, PDFKit PDF output |
| Reports / Imports | ExcelJS, CSV parsing, CSV/XLSX/PDF exports |

## Implemented Scope

- Master data for police units/stations, designations, quarter types, areas,
  and rank-wise eligibility rules.
- User administration with activation controls and administrator password reset.
- Personnel records linked to rank and current posting unit.
- Quarter inventory and status history, including existing occupancy recording.
- Correspondence-originated inventory changes routed to Admin approval.
- CSV/XLSX quarter import, including occupied inventory records.
- Draft, submission, duplicate review, verification, waitlist, allotment, and
  closed application processing.
- Transfer/change applications that vacate the prior quarter during allotment.
- Mandatory application-letter attachment and special-case supporting document.
- Role dashboards, notifications, audit log, reports, exports, acknowledgement
  PDF, and allotment-order PDF.

## Role Access

| Role | Primary Access |
| --- | --- |
| `ADMIN` | Users, master data, eligibility, quarter administration, duplicate/Admin review, approval of Correspondence inventory requests, audit and exports |
| `CORRESPONDENCE_BRANCH` | Inventory entry/change requests, occupancy verification workflow, application verification, reports and exports |
| `SUPER_ADMIN` | Final application decision, waitlist, final quarter allotment, allotment documents, audit and exports |
| `UNIT_USER` | Personnel for own unit, draft application submission, attachment upload, application tracking, own-unit reporting |
| `VIEWER` | Read-only review queues, audit data, dashboard/report access permitted by endpoints |

Seeded users must change their password after first login. Until that change is
complete, protected operational routes are blocked.

## Application Workflow

### New allotment

1. A `UNIT_USER` creates a `DRAFT` application for personnel in their unit.
2. The user adds up to three preferences and uploads the mandatory application
   letter; a special case also requires supporting evidence.
3. Submission checks eligibility, active occupancy/application conflicts, and
   possible duplicate records.
4. Clean submissions proceed to `ADMIN_REVIEW`; possible matches proceed to
   `DUPLICATE_REVIEW`.
5. Admin reviews and forwards accepted applications to
   `CORRESPONDENCE_REVIEW`.
6. Correspondence verifies and forwards to `SUPER_ADMIN_REVIEW`.
7. Super Admin may return, reject, waitlist, or approve pending allotment.
8. Allotment selects an available approved quarter, creates current occupancy,
   marks the quarter occupied, records history, and closes the application.

### Transfer/change allotment

The flow is the same as above, but the application requires a transfer reason.
When final allotment occurs, the previous occupancy is ended and its quarter is
placed into `VACATED_PENDING_INSPECTION` before the new occupancy is created.

### Server-controlled status transitions

```text
DRAFT -> SUBMITTED -> ADMIN_REVIEW -> CORRESPONDENCE_REVIEW
      -> SUPER_ADMIN_REVIEW -> APPROVED_PENDING_ALLOTMENT -> CLOSED

SUBMITTED -> DUPLICATE_REVIEW -> ADMIN_REVIEW or REJECTED
ADMIN_REVIEW / CORRESPONDENCE_REVIEW / SUPER_ADMIN_REVIEW
      -> RETURNED_FOR_RECONSIDERATION -> SUBMITTED
SUPER_ADMIN_REVIEW -> APPROVED_WAITLIST or REJECTED
DRAFT / SUBMITTED -> CANCELLED
```

## Local Setup

### Prerequisites

- Node.js 22 or later
- npm
- PostgreSQL reachable on `localhost:5566`
- A PostgreSQL user permitted to create and migrate the database

### Install dependencies

```bash
npm install
```

### Create local environment configuration

Create `backend/.env` from `backend/.env.example` and replace placeholders:

```env
NODE_ENV=development
PORT=3120
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5566/police_quarter_allocation?schema=public"
JWT_SECRET="<use-a-long-random-secret-of-at-least-24-characters>"
JWT_EXPIRES_IN="1h"
REFRESH_DAYS=7
UPLOAD_ROOT="./uploads"
MAX_FILE_SIZE_MB=10
APP_BASE_URL="http://localhost:3120"
```

`backend/.env` is ignored by Git and must never be committed.

### Create the database

Using `psql`:

```bash
psql -h localhost -p 5566 -U postgres -c "CREATE DATABASE police_quarter_allocation;"
```

If it already exists, PostgreSQL reports that fact and you can proceed.

### Apply schema and seed records

```bash
npm run db:migrate
npm run db:seed
```

### Run in development mode

```bash
npm run dev
```

Open `http://localhost:3120`.

### Run a production build locally

```bash
npm run build
set NODE_ENV=production
npm start
```

For PowerShell:

```powershell
$env:NODE_ENV = "production"
npm start
```

## Configuration

| Variable | Required | Default / Example | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Switches Vite middleware or static production frontend hosting |
| `PORT` | No | `3120` | Single application/API public port |
| `DATABASE_URL` | Yes | PostgreSQL connection URI | Prisma database connection |
| `JWT_SECRET` | Yes | No production default | Signs access tokens; minimum 24 characters |
| `JWT_EXPIRES_IN` | No | `1h` | Access token lifetime |
| `REFRESH_DAYS` | No | `7` | Refresh session cookie lifetime in days |
| `UPLOAD_ROOT` | No | `./uploads` | Private attachment storage relative to backend |
| `MAX_FILE_SIZE_MB` | No | `10` | Application attachment size limit |
| `APP_BASE_URL` | No | `http://localhost:3120` | Application base URL |

## Seed Data

Running `npm run db:seed` safely upserts:

- Rajkot police stations, branches, and headquarters master units.
- Designations: `LR`, `PC`, `HC`, `ASI`, `PSI`, `PI`, `ACP`.
- Quarter types: `1 BHK`, `2 BHK`, `3 BHK`.
- Areas: `Police Headquarter`, `Ramnath Para`, `Mounted Police Line`.
- Eligibility rules for each designation and quarter type.
- Bootstrap user accounts.

### Bootstrap accounts

All accounts initially use `Admin@12345` and are forced to change it on first
login.

| Username | Role | Assigned Unit |
| --- | --- | --- |
| `admin` | `ADMIN` | Headquarters |
| `superadmin` | `SUPER_ADMIN` | Headquarters |
| `correspondence` | `CORRESPONDENCE_BRANCH` | Headquarters |
| `unituser` | `UNIT_USER` | Bhaktinagar Police Station |
| `viewer` | `VIEWER` | Headquarters |

### Initial eligibility matrix

| Designation | 1 BHK | 2 BHK | 3 BHK |
| --- | --- | --- | --- |
| LR | Eligible | Not eligible | Not eligible |
| PC | Eligible | Not eligible | Not eligible |
| HC | Eligible | Eligible | Not eligible |
| ASI | Eligible | Eligible | Not eligible |
| PSI | Eligible | Eligible | Not eligible |
| PI | Eligible | Eligible | Eligible |
| ACP | Eligible | Eligible | Not eligible |

Admin may edit eligibility rules from Master Data after deployment.

## File Uploads and Import

### Application attachments

Attachments are stored in `backend/uploads/`, outside public frontend assets.
Downloads pass through authenticated API access checks.

| Rule | Value |
| --- | --- |
| Accepted MIME types | PDF, JPEG, PNG |
| Maximum attachment size | Controlled by `MAX_FILE_SIZE_MB`, default `10 MB` |
| Mandatory standard document | `APPLICATION_LETTER` |
| Mandatory special-case document | `SPECIAL_CASE_DOCUMENT` when special case is selected |

### Quarter bulk import

Inventory import accepts `.csv` or `.xlsx`. The principal headings are:

```text
Area, Quarter Type, Wing, Block, Floor, House Number, Status,
Condition Remarks, Electricity Meter No, Water Connection No,
Resident Index Number, Resident Buckle Number, Resident Name,
Resident Mobile Number, Resident Designation, Resident Posting, Allocated Date
```

For an `OCCUPIED` row, resident fields and allocated date are required. Admin
imports are applied immediately. Correspondence imports create a pending
`quarter_change_requests` entry for Admin approval.

## API Reference

### Response envelope

Successful API responses use:

```json
{ "success": true, "message": "Description", "data": {} }
```

Errors use:

```json
{ "success": false, "message": "Description", "errors": [] }
```

Except for authentication routes, API routes require an access token and
completed first-login password change. Refresh tokens are stored in an
HTTP-only cookie scoped to `/api/auth`.

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Authenticate and obtain access token plus refresh cookie |
| `POST` | `/api/auth/refresh` | Rotate refresh session and issue new access token |
| `POST` | `/api/auth/logout` | Revoke refresh cookie session |
| `GET` | `/api/auth/me` | Retrieve current authenticated user |
| `POST` | `/api/auth/change-password` | Change password and remove first-login restriction |

Login allows eight failed attempts in fifteen minutes before returning HTTP
`429`.

### Administration and master data

| Resource | Endpoints | Write Role |
| --- | --- | --- |
| Users | `GET/POST /api/users`, `GET/PATCH /api/users/:id`, `PATCH /api/users/:id/status`, `POST /api/users/:id/reset-password` | `ADMIN` |
| Police units/stations | `GET/POST /api/police-units`, `PATCH/DELETE /api/police-units/:id` | `ADMIN` |
| Designations | `GET/POST /api/designations`, `PATCH/DELETE /api/designations/:id` | `ADMIN` |
| Quarter types | `GET/POST /api/quarter-types`, `PATCH/DELETE /api/quarter-types/:id` | `ADMIN` |
| Areas | `GET/POST /api/areas`, `PATCH/DELETE /api/areas/:id` | `ADMIN` |
| Eligibility | `GET/POST /api/eligibility-rules`, `GET /api/eligibility-rules/check`, `PATCH /api/eligibility-rules/:id` | `ADMIN` |

Delete actions on master data are administrative deactivation actions unless
data is explicitly removed through controlled database maintenance.

### Quarters and occupancy

| Method | Endpoint | Purpose / Role |
| --- | --- | --- |
| `GET` | `/api/quarters`, `/api/quarters/available`, `/api/quarters/summary`, `/api/quarters/:id` | Authenticated inventory reads |
| `POST` | `/api/quarters` | Admin direct creation; Correspondence approval request |
| `PATCH` | `/api/quarters/:id` | Admin direct update; Correspondence approval request |
| `DELETE` | `/api/quarters/:id` | Admin deactivation |
| `PATCH` | `/api/quarters/:id/status` | Admin direct status update; Correspondence approval request |
| `GET` | `/api/occupancy-records` | Operational occupancy reads |
| `POST` | `/api/occupancy-records` | Admin existing-occupancy recording |
| `POST` | `/api/quarters/bulk-upload` | Admin or Correspondence CSV/XLSX import |
| `GET` | `/api/quarter-change-requests` | Admin or request-owning Correspondence |
| `POST` | `/api/quarter-change-requests/:id/approve` | Admin approval |
| `POST` | `/api/quarter-change-requests/:id/reject` | Admin rejection |

### Personnel

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/personnel` | List/create records |
| `GET/PATCH/DELETE` | `/api/personnel/:id` | Detail, update, or Admin deactivate |
| `GET` | `/api/personnel/search-duplicate` | Search potential duplicate personnel |
| `GET` | `/api/personnel/by-index/:indexNumber` | Locate by index number |
| `GET` | `/api/personnel/by-buckle/:buckleNumber` | Locate by buckle number |
| `GET` | `/api/personnel/:id/current-occupancy` | Current quarter occupancy |
| `GET` | `/api/personnel/:id/application-history` | Applicant application history |

### Applications and decisions

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/applications` | Search or create Unit User draft |
| `GET/PATCH` | `/api/applications/:id` | Read or edit permitted draft/returned record |
| `POST` | `/api/applications/:id/submit` | Validate and submit draft |
| `POST` | `/api/applications/:id/resubmit` | Resubmit returned application |
| `POST` | `/api/applications/:id/cancel` | Unit User cancellation |
| `GET` | `/api/applications/:id/history` | Approval history |
| `GET` | `/api/applications/:id/duplicates` | Duplicate review information |
| `POST/GET` | `/api/applications/:id/attachments` | Upload/list protected attachments |
| `GET` | `/api/attachments/:id/download` | Authorized document download |
| `PATCH` | `/api/attachments/:id/verify` | Admin/Correspondence document verification |
| `DELETE` | `/api/attachments/:id` | Remove permitted pre-submission attachment |
| `POST` | `/api/applications/:id/admin-review` | Admin decision |
| `POST` | `/api/applications/:id/correspondence-review` | Correspondence verification decision |
| `POST` | `/api/applications/:id/super-admin/return` | Super Admin return |
| `POST` | `/api/applications/:id/super-admin/reject` | Super Admin rejection |
| `POST` | `/api/applications/:id/super-admin/approve-waitlist` | Super Admin waitlist approval |
| `POST` | `/api/applications/:id/super-admin/approve-pending-allotment` | Super Admin allocation readiness |
| `POST` | `/api/applications/:id/super-admin/allot` | Super Admin final allotment |
| `GET` | `/api/applications/:id/acknowledgement/pdf` | Application acknowledgement PDF |
| `GET` | `/api/applications/:id/allotment-order/pdf` | Allotment order PDF |

### Dashboards, notifications, audit, and reports

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications` | Current user's latest notifications |
| `PATCH` | `/api/notifications/:id/read` | Mark own notification read |
| `GET` | `/api/audit-logs` | Admin, Super Admin, Viewer audit access |
| `GET` | `/api/dashboard/admin` | Admin metrics and queue |
| `GET` | `/api/dashboard/correspondence` | Correspondence metrics and queue |
| `GET` | `/api/dashboard/super-admin` | Super Admin and Viewer metrics |
| `GET` | `/api/dashboard/unit` | Unit User unit-scoped metrics |
| `GET` | `/api/reports/:reportType` | Authorized report data |
| `GET` | `/api/reports/export/:reportType?format=csv|excel|pdf` | Operational-role export |

Supported report types are `quarter-availability`, `quarter-occupancy`,
`pending-applications`, `urgent-applications`, `waitlist`,
`duplicate-applications`, `allotment-history`, `application-aging`, and
`occupancy-duration`.

## Database Overview

The relational model separates:

- Master and access control: `police_units`, `users`, `designations`,
  `quarter_types`, `areas`, `eligibility_rules`.
- Inventory and residence: `quarters`, `personnel`, `occupancy_records`,
  `quarter_status_history`, `quarter_change_requests`.
- Workflow: `applications`, `application_preferences`, `attachments`,
  `duplicate_checks`, `approval_history`, `allotments`.
- Operational security and communication: `refresh_sessions`,
  `notifications`, `audit_logs`.

Primary keys are PostgreSQL UUID values generated by `gen_random_uuid()`.
Timestamp fields use PostgreSQL timestamps, while allocation and possession
dates use SQL `DATE`.

### Core relationship map

```text
police_units <- users
police_units <- personnel -> designations -> eligibility_rules -> quarter_types
areas -> quarters <- quarter_types
personnel -> occupancy_records <- quarters
personnel -> applications <- users / police_units
applications -> application_preferences -> areas / quarter_types
applications -> attachments
applications -> duplicate_checks
applications -> approval_history
applications -> allotments -> quarters / personnel
quarters -> quarter_status_history
users -> refresh_sessions / notifications / audit_logs
users -> quarter_change_requests -> quarters
```

## Database Enums

| Enum | Values |
| --- | --- |
| `user_role` | `SUPER_ADMIN`, `ADMIN`, `CORRESPONDENCE_BRANCH`, `UNIT_USER`, `VIEWER` |
| `unit_type` | `POLICE_STATION`, `BRANCH`, `HEADQUARTER`, `OTHER` |
| `quarter_status` | `AVAILABLE`, `OCCUPIED`, `UNDER_REPAIR`, `RESERVED`, `VACATED_PENDING_INSPECTION`, `DISPUTED`, `INACTIVE` |
| `application_type` | `NEW_ALLOTMENT`, `TRANSFER_CHANGE` |
| `application_status` | `DRAFT`, `SUBMITTED`, `DUPLICATE_REVIEW`, `ADMIN_REVIEW`, `CORRESPONDENCE_REVIEW`, `SUPER_ADMIN_REVIEW`, `RETURNED_FOR_RECONSIDERATION`, `APPROVED_WAITLIST`, `APPROVED_PENDING_ALLOTMENT`, `ALLOTTED`, `REJECTED`, `CANCELLED`, `CLOSED` |
| `urgency_category` | `MEDICAL`, `DISABILITY`, `WIDOW_COMPASSIONATE`, `DISTANCE_FROM_POSTING`, `FAMILY_SAFETY`, `LAW_AND_ORDER_SENSITIVITY`, `GOVERNMENT_DUTY_URGENCY`, `EXISTING_QUARTER_UNSAFE`, `OTHER` |
| `attachment_type` | `APPLICATION_LETTER`, `SPECIAL_CASE_DOCUMENT`, `ID_PROOF`, `CURRENT_QUARTER_DOCUMENT`, `OTHER` |
| `approval_action` | `SUBMITTED`, `VERIFIED`, `RETURNED`, `REJECTED`, `APPROVED_WAITLIST`, `APPROVED_PENDING_ALLOTMENT`, `ALLOTTED`, `CANCELLED`, `CLOSED` |
| `duplicate_match_strength` | `LOW`, `MEDIUM`, `HIGH`, `EXACT` |
| `change_request_type` | `CREATE_QUARTER`, `UPDATE_QUARTER`, `STATUS_CHANGE`, `BULK_IMPORT` |
| `change_request_status` | `PENDING`, `APPROVED`, `REJECTED` |

## Database Table Dictionary

Notation: `PK` means primary key, `FK` means foreign key, `UQ` means unique,
and `NULL` means optional.

### `police_units`

Master list of police stations, branches, and headquarters.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | VARCHAR(200) | UQ, unit/station display name |
| `unit_type` | `unit_type` | Station, branch, headquarters, or other |
| `address` | TEXT | NULL, office/station address |
| `contact_number` | VARCHAR(20) | NULL |
| `is_active` | BOOLEAN | Defaults `true`; deactivation flag |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `users`

Login accounts and their role/unit assignment.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `full_name` | VARCHAR(150) | User name |
| `username` | VARCHAR(80) | UQ login identifier |
| `password_hash` | TEXT | bcrypt password digest |
| `role` | `user_role` | Authorization role |
| `police_unit_id` | UUID | NULL, FK -> `police_units.id` |
| `mobile_number` | VARCHAR(20) | NULL |
| `email` | VARCHAR(150) | NULL |
| `is_active` | BOOLEAN | Defaults `true`; login is blocked when false |
| `must_change_password` | BOOLEAN | Defaults `true`; blocks operations until changed |
| `last_login_at` | TIMESTAMP | NULL |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `designations`

Rank master used for personnel and eligibility.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `code` | VARCHAR(20) | UQ, e.g. `PC`, `ACP` |
| `name` | VARCHAR(100) | Rank name |
| `rank_order` | INTEGER | Sorting order |
| `is_active` | BOOLEAN | Defaults `true` |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `quarter_types`

Quarter classification master such as `1 BHK`.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | VARCHAR(50) | UQ |
| `description` | TEXT | NULL |
| `is_active` | BOOLEAN | Defaults `true` |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `areas`

Quarter-location master.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | VARCHAR(150) | UQ |
| `description` | TEXT | NULL |
| `address` | TEXT | NULL |
| `is_active` | BOOLEAN | Defaults `true` |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `eligibility_rules`

Defines which designations may request each quarter type.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `designation_id` | UUID | FK -> `designations.id` |
| `quarter_type_id` | UUID | FK -> `quarter_types.id` |
| `is_eligible` | BOOLEAN | Defaults `false` |
| `requires_special_approval` | BOOLEAN | Defaults `false` |
| `remarks` | TEXT | NULL |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

Unique rule: one row per (`designation_id`, `quarter_type_id`).

### `quarters`

Physical residential inventory and its current inventory status.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `area_id` | UUID | FK -> `areas.id` |
| `quarter_type_id` | UUID | FK -> `quarter_types.id` |
| `wing`, `block`, `floor` | VARCHAR(50) | NULL location components |
| `house_number` | VARCHAR(80) | Required house/unit identifier |
| `full_quarter_code` | VARCHAR(150) | NULL, UQ reporting code |
| `status` | `quarter_status` | Defaults `AVAILABLE` |
| `condition_remarks` | TEXT | NULL |
| `electricity_meter_no` | VARCHAR(100) | NULL |
| `water_connection_no` | VARCHAR(100) | NULL |
| `is_active` | BOOLEAN | Defaults `true` |
| `created_by`, `updated_by` | UUID | NULL, FK -> `users.id` |
| `approved_by_admin` | BOOLEAN | Defaults `false`; required for allotment |
| `admin_approved_by` | UUID | NULL, FK -> `users.id` |
| `admin_approved_at` | TIMESTAMP | NULL |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `personnel`

Police personnel for whom applications and occupancy are recorded.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `index_number` | VARCHAR(80) | UQ |
| `buckle_number` | VARCHAR(80) | UQ |
| `full_name` | VARCHAR(150) | Personnel name |
| `mobile_number` | VARCHAR(20) | Contact |
| `designation_id` | UUID | FK -> `designations.id` |
| `current_police_unit_id` | UUID | FK -> `police_units.id` |
| `current_address` | TEXT | Residential/current address |
| `is_active` | BOOLEAN | Defaults `true` |
| `created_by`, `updated_by` | UUID | NULL, FK -> `users.id` |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `occupancy_records`

Residence history; active rows identify current possession.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `personnel_id` | UUID | FK -> `personnel.id` |
| `quarter_id` | UUID | FK -> `quarters.id` |
| `allocated_date` | DATE | Required allocation date |
| `possession_date` | DATE | NULL |
| `vacated_date` | DATE | NULL, set on closure/transfer |
| `is_current` | BOOLEAN | Defaults `true` |
| `allocation_reference_no` | VARCHAR(100) | NULL |
| `remarks` | TEXT | NULL |
| `created_by`, `closed_by` | UUID | NULL, FK -> `users.id` |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `applications`

Principal application and workflow-state record.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `application_no` | VARCHAR(100) | UQ application reference |
| `application_type` | `application_type` | New allotment or transfer/change |
| `personnel_id` | UUID | FK -> `personnel.id` |
| `submitted_by_user_id` | UUID | FK -> `users.id` |
| `submitted_by_unit_id` | UUID | FK -> `police_units.id` |
| `status` | `application_status` | Defaults `DRAFT` |
| `applying_for_group` | BOOLEAN | Defaults `false` |
| `group_details` | TEXT | NULL |
| `current_quarter_id` | UUID | NULL, FK -> `quarters.id` |
| `current_quarter_text` | TEXT | NULL legacy/current residence text |
| `reason_for_change` | TEXT | Required for transfer/change |
| `is_special_case` | BOOLEAN | Defaults `false` |
| `special_case_category` | `urgency_category` | NULL, required for special case |
| `special_case_reason` | TEXT | NULL, required for special case |
| `recommended_by_officer` | BOOLEAN | Defaults `false` |
| `recommending_officer_name` | VARCHAR(150) | NULL |
| `recommending_officer_designation` | VARCHAR(100) | NULL |
| `duplicate_flag` | BOOLEAN | Defaults `false` |
| `duplicate_summary` | TEXT | NULL |
| `admin_remarks` | TEXT | NULL |
| `correspondence_remarks` | TEXT | NULL |
| `super_admin_remarks` | TEXT | NULL |
| `submitted_at`, `closed_at` | TIMESTAMP | NULL workflow timestamps |
| `created_at`, `updated_at` | TIMESTAMP | Lifecycle timestamps |

### `application_preferences`

Up to three ordered application location/type choices.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `application_id` | UUID | FK -> `applications.id`, cascade delete |
| `area_id` | UUID | FK -> `areas.id` |
| `quarter_type_id` | UUID | FK -> `quarter_types.id` |
| `preference_order` | INTEGER | Must be between `1` and `3` |
| `created_at` | TIMESTAMP | Creation timestamp |

Unique rule: one row for each application/order position.

### `attachments`

Private uploaded application documents.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `application_id` | UUID | FK -> `applications.id`, cascade delete |
| `uploaded_by_user_id` | UUID | FK -> `users.id` |
| `attachment_type` | `attachment_type` | Document category |
| `original_file_name` | VARCHAR(255) | Original client filename |
| `stored_file_name` | VARCHAR(255) | Private generated storage filename |
| `file_path` | TEXT | Private disk location |
| `mime_type` | VARCHAR(100) | Validated content type |
| `file_size_bytes` | BIGINT | Uploaded size |
| `description` | TEXT | NULL |
| `is_verified` | BOOLEAN | Defaults `false` |
| `verified_by` | UUID | NULL, FK -> `users.id` |
| `verified_at` | TIMESTAMP | NULL |
| `created_at` | TIMESTAMP | Creation timestamp |

### `duplicate_checks`

Potential duplicate matches and Admin review result.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `application_id` | UUID | FK -> `applications.id`, cascade delete |
| `matched_personnel_id` | UUID | NULL, FK -> `personnel.id` |
| `matched_application_id` | UUID | NULL, FK -> `applications.id` |
| `match_strength` | `duplicate_match_strength` | Match classification |
| `match_reason` | TEXT | Explanation |
| `match_score` | INTEGER | Defaults `0` |
| `reviewed_by` | UUID | NULL, FK -> `users.id` |
| `reviewed_at` | TIMESTAMP | NULL |
| `is_confirmed_duplicate` | BOOLEAN | NULL until reviewed |
| `review_remarks` | TEXT | NULL |
| `created_at` | TIMESTAMP | Creation timestamp |

### `approval_history`

Immutable application status/action history.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `application_id` | UUID | FK -> `applications.id`, cascade delete |
| `action` | `approval_action` | Action recorded |
| `from_status`, `to_status` | `application_status` | NULL status transition endpoints |
| `remarks` | TEXT | NULL |
| `acted_by` | UUID | FK -> `users.id` |
| `acted_at` | TIMESTAMP | Defaults current timestamp |

### `allotments`

Final allocation record issued by Super Admin.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `application_id` | UUID | UQ, FK -> `applications.id` |
| `personnel_id` | UUID | FK -> `personnel.id` |
| `quarter_id` | UUID | FK -> `quarters.id` |
| `previous_quarter_id` | UUID | NULL, FK -> `quarters.id`, transfer tracking |
| `allotment_order_no` | VARCHAR(100) | NULL, UQ |
| `allotment_date` | DATE | Allocation effective date |
| `possession_due_date` | DATE | NULL |
| `remarks` | TEXT | NULL |
| `approved_by` | UUID | FK -> `users.id` |
| `created_at` | TIMESTAMP | Creation timestamp |

### `quarter_status_history`

Audit-oriented history of inventory status changes.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `quarter_id` | UUID | FK -> `quarters.id` |
| `old_status` | `quarter_status` | NULL for initial event |
| `new_status` | `quarter_status` | New status |
| `reason` | TEXT | NULL |
| `changed_by` | UUID | FK -> `users.id` |
| `changed_at` | TIMESTAMP | Defaults current timestamp |

### `audit_logs`

Security and operational audit trail.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | NULL, FK -> `users.id` |
| `user_role` | `user_role` | NULL role snapshot |
| `action` | VARCHAR(100) | Event/action name |
| `entity_type` | VARCHAR(100) | Object category |
| `entity_id` | UUID | NULL affected object |
| `old_value`, `new_value` | JSONB | NULL before/after data |
| `ip_address` | VARCHAR(80) | NULL |
| `user_agent` | TEXT | NULL |
| `created_at` | TIMESTAMP | Creation timestamp |

### `refresh_sessions`

Rotating refresh-token session store.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK -> `users.id`, cascade delete |
| `token_hash` | TEXT | UQ; raw refresh token is not stored |
| `expires_at` | TIMESTAMP | Expiration |
| `revoked_at` | TIMESTAMP | NULL until revoked/rotated |
| `created_at` | TIMESTAMP | Creation timestamp |

### `notifications`

In-application alerts delivered to users.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK -> `users.id`, cascade delete |
| `application_id` | UUID | NULL, FK -> `applications.id` |
| `title` | VARCHAR(150) | Notification title |
| `message` | TEXT | Notification message |
| `is_read` | BOOLEAN | Defaults `false` |
| `created_at` | TIMESTAMP | Creation timestamp |

### `quarter_change_requests`

Approval queue for Correspondence-originated inventory modifications.

| Column | Type | Rules / Purpose |
| --- | --- | --- |
| `id` | UUID | PK |
| `request_type` | `change_request_type` | Requested inventory action |
| `quarter_id` | UUID | NULL, FK -> `quarters.id` |
| `payload` | JSONB | Proposed record/change/import data |
| `status` | `change_request_status` | Defaults `PENDING` |
| `remarks` | TEXT | NULL review remarks |
| `created_by` | UUID | FK -> `users.id` |
| `reviewed_by` | UUID | NULL, FK -> `users.id` |
| `reviewed_at` | TIMESTAMP | NULL |
| `created_at` | TIMESTAMP | Creation timestamp |

## Database Constraints and Indexes

### Business-rule constraints

| Constraint / Index | Enforcement |
| --- | --- |
| `ux_quarter_location_unique` | Prevents duplicate location/type/house inventory, treating null wing/block/floor as equal |
| `ux_one_current_quarter_per_person` | A person cannot occupy more than one current quarter |
| `ux_one_current_person_per_quarter` | A quarter cannot have more than one current occupant |
| `ux_one_active_application_per_person` | A person cannot hold multiple draft/in-process applications |
| `chk_preference_order` | Preference sequence is restricted to `1` through `3` |
| `chk_transfer_reason` | `TRANSFER_CHANGE` applications require a non-empty reason |
| `chk_special_case_details` | Special-case applications require category and reason |

### Search/report indexes

| Table | Index Columns | Purpose |
| --- | --- | --- |
| `quarters` | `status`, `area_id`, `quarter_type_id` | Availability and summary filtering |
| `personnel` | `full_name`, `mobile_number` | Duplicate/person search |
| `occupancy_records` | `personnel_id`, `is_current`; `quarter_id`, `is_current` | Current occupancy lookups |
| `applications` | `status`, `submitted_at`; `personnel_id`, `status` | Review queues and active checks |
| `audit_logs` | `entity_type`, `entity_id`; `created_at` | Audit investigation |
| `notifications` | `user_id`, `is_read`, `created_at` | User notification inbox |
| `quarter_change_requests` | `status`, `created_at` | Pending approval queue |

## Project Structure

```text
.
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   |-- schema.prisma
|   |   `-- seed.ts
|   |-- src/
|   |   |-- middleware/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- app.ts
|   |   `-- server.ts
|   |-- tests/
|   |-- uploads/                 # private runtime files, ignored by Git
|   `-- .env.example
|-- frontend/
|   |-- src/
|   |   |-- api/
|   |   |-- auth/
|   |   |-- App.tsx
|   |   `-- pages.tsx
|   `-- vite.config.ts
|-- package.json                 # npm workspace commands
`-- police_quarter_allocation_app_spec.md
```

## Commands and Validation

| Command | Action |
| --- | --- |
| `npm install` | Install root, backend, and frontend workspace dependencies |
| `npm run dev` | Start Express plus Vite development middleware on port `3120` |
| `npm run build` | Compile frontend production assets and backend TypeScript |
| `npm start` | Run the compiled backend, serving built frontend in production mode |
| `npm run db:migrate` | Apply Prisma database migrations |
| `npm run db:seed` | Upsert master data and bootstrap users |
| `npm test` | Run backend and frontend configured tests |

Current automated backend tests cover workflow helpers and role-scoping rules.
The frontend test command succeeds with no test files until component tests are
added.

## Security Notes

- Never commit `backend/.env`, real JWT secrets, database passwords, or files
  from `backend/uploads/`.
- Change the seeded passwords immediately after initial setup.
- Replace the example JWT secret before any shared or production deployment.
- Use HTTPS in deployment so the refresh cookie is transported securely.
- Treat uploads as confidential records and protect database backups likewise.
- The configured login rate limiter rejects repeated failed authentication
  attempts with HTTP `429`; wait for the limiter interval or restart only in a
  controlled local-development environment.
