# Police Quarter Allocation Management System (PQAMS)

## AI Development Specification for Node.js + React + PostgreSQL

Use this document as the direct development brief for building the application from scratch.

---

## 1. Project Summary

Build a secure web application for managing Police residential quarter allocation.

The system must support:

- Quarter inventory management
- Occupied/vacant quarter records
- New quarter allotment applications
- Existing quarter transfer/change applications
- Rank-wise quarter eligibility
- Duplicate application prevention
- Urgency/special-case prioritization
- Mandatory application letter upload
- Mandatory supporting documents when special case is selected
- Multi-role approval workflow
- Super Admin quarter allotment
- Automatic quarter status update after allotment
- Reports, dashboards, audit logs, and file access control

---

## 2. Selected Technology Stack

### Backend

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM recommended
- Zod or Joi for request validation
- Multer for file uploads
- bcrypt for password hashing
- JWT or secure session authentication
- Winston/Pino for logging

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod validation
- Tailwind CSS or Material UI
- Axios for API calls

### Database

- PostgreSQL

### PostgreSQL Connection Details

Use these details in `.env`:

```env
DATABASE_URL="postgresql://postgress:change-me@localhost:5566/police_quarter_allocation?schema=public"

DB_HOST=localhost
DB_PORT=5566
DB_USER=postgress
DB_PASSWORD=change-me
DB_NAME=police_quarter_allocation
```

> Note: The database username has been provided as `postgress`. If connection fails, verify whether the actual PostgreSQL username is `postgres`.

---

## 3. Recommended Folder Structure

```text
police-quarter-allocation/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── database.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── role.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   ├── upload.middleware.ts
│   │   │   └── audit.middleware.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── police-units/
│   │   │   ├── designations/
│   │   │   ├── quarter-types/
│   │   │   ├── areas/
│   │   │   ├── quarters/
│   │   │   ├── personnel/
│   │   │   ├── applications/
│   │   │   ├── duplicate-checks/
│   │   │   ├── approvals/
│   │   │   ├── allotments/
│   │   │   ├── attachments/
│   │   │   ├── reports/
│   │   │   └── dashboard/
│   │   ├── services/
│   │   │   ├── duplicate.service.ts
│   │   │   ├── eligibility.service.ts
│   │   │   ├── file-storage.service.ts
│   │   │   ├── allotment.service.ts
│   │   │   └── audit.service.ts
│   │   ├── utils/
│   │   └── types/
│   ├── uploads/
│   │   ├── application-letters/
│   │   ├── special-case-documents/
│   │   └── other/
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── forms/
│   │   │   ├── tables/
│   │   │   ├── dashboard/
│   │   │   └── common/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── quarters/
│   │   │   ├── applications/
│   │   │   ├── personnel/
│   │   │   ├── reports/
│   │   │   ├── admin/
│   │   │   └── users/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── stores/
│   │   └── utils/
│   ├── package.json
│   └── .env
│
├── docs/
│   ├── database-schema.sql
│   ├── api-spec.md
│   └── workflow.md
└── README.md
```

---

## 4. User Roles and Permissions

### 4.1 Roles

| Role | Code | Description |
|---|---|---|
| Super Admin | `SUPER_ADMIN` | Commissioner / Addl. Commissioner. Final quarter allotment authority. |
| Administrator | `ADMIN` | Manages master data, users, quarter records, duplicate review, corrections. |
| Correspondence Branch | `CORRESPONDENCE_BRANCH` | Maintains quarter inventory, occupancy records, vacancy records. |
| Station / Branch User | `UNIT_USER` | Police Station / Branch / Headquarter login for submitting applications. |
| Viewer / Audit | `VIEWER` | Read-only access for audit/senior review. |

### 4.2 Permission Matrix

| Feature | Super Admin | Admin | Correspondence | Unit User | Viewer |
|---|---:|---:|---:|---:|---:|
| View dashboard | Yes | Yes | Yes | Yes | Yes |
| Create users | No | Yes | No | No | No |
| Manage police stations/branches | No | Yes | No | No | No |
| Manage designations | No | Yes | No | No | No |
| Manage eligibility rules | No | Yes | No | No | No |
| Add/edit quarter inventory | View only | Yes | Yes, pending admin approval | No | View only |
| Approve correspondence entries | No | Yes | No | No | No |
| Submit application | No | Optional | Optional | Yes | No |
| Upload application letter | No | Optional | Optional | Yes | No |
| Upload special case documents | No | Optional | Optional | Yes | No |
| Review duplicate applications | View | Yes | View | No | View |
| Verify application | View | Yes | Yes | No | View |
| Final approve/reject/return | Yes | No | No | No | No |
| Allot specific quarter | Yes | No | No | No | No |
| Generate reports | Yes | Yes | Yes | Limited | View only |
| Export PDF/Excel | Yes | Yes | Yes | Own unit only | Optional |
| View audit logs | Yes | Yes | No | No | View only |

---

## 5. Master Data

### 5.1 Designations

Initial values:

```text
LR
PC
HC
ASI
PSI
PI
ACP
```

Fields:

- Code
- Display name
- Rank order
- Active/inactive

### 5.2 Quarter Types

Initial values:

```text
1 BHK
2 BHK
3 BHK
```

Fields:

- Name
- Description
- Active/inactive

### 5.3 Areas

Initial values:

```text
Police Headquarter
Ramnath Para
Mounted Police Line
```

Fields:

- Area name
- Address/description
- Active/inactive

### 5.4 Police Units

Police Station / Branch / Headquarter entries.

Fields:

- Unit name
- Unit type: `POLICE_STATION`, `BRANCH`, `HEADQUARTER`, `OTHER`
- Address
- Contact number
- Active/inactive

---

## 6. Core Business Rules

### 6.1 Quarter Eligibility

Eligibility must be configurable through database table, not hardcoded.

Default rule:

- PI can apply for 3 BHK.
- Other ranks cannot apply for 3 BHK unless Administrator changes eligibility rule.
- 1 BHK and 2 BHK eligibility should be configurable rank-wise.
- ACP needs policy decision; keep configurable.

### 6.2 Application Type Rules

There are two main application types:

1. `NEW_ALLOTMENT`
2. `TRANSFER_CHANGE`

#### New Allotment Rules

A personnel can apply for new allotment only if:

- Personnel does not currently have an occupied quarter.
- Personnel does not have another active application.
- Requested quarter type is allowed for designation.
- Mandatory application letter is uploaded.

#### Transfer / Change Rules

A personnel can apply for transfer/change only if:

- Personnel currently has an occupied quarter.
- Personnel does not have another active transfer/change request.
- Personnel does not have another active new-allotment request.
- Mandatory application letter is uploaded.
- Reason for change is provided.

### 6.3 Active Application Statuses

A personnel cannot submit another application if any application is in one of these statuses:

```text
DRAFT
SUBMITTED
DUPLICATE_REVIEW
ADMIN_REVIEW
CORRESPONDENCE_REVIEW
SUPER_ADMIN_REVIEW
RETURNED_FOR_RECONSIDERATION
APPROVED_WAITLIST
APPROVED_PENDING_ALLOTMENT
```

A new application is allowed only after previous application is:

```text
REJECTED
CANCELLED
CLOSED
```

### 6.4 Returned Application Rule

If application is returned for reconsideration:

- Do not allow a fresh application.
- Same application must be corrected and resubmitted.

### 6.5 Special Case / Urgency Rule

If `is_special_case = true`:

- Special case category is mandatory.
- Special case reason is mandatory.
- At least one supporting document is mandatory.
- Special cases should appear first in Super Admin review dashboard.
- Special case does not guarantee approval.

### 6.6 Application Letter Upload Rule

Every submitted application must include one compulsory application letter attachment.

Mandatory document:

```text
APPLICATION_LETTER
```

Allowed file types:

```text
PDF
JPG
JPEG
PNG
```

Recommended max file size:

```text
10 MB per file
```

### 6.7 Quarter Status Rule

Quarter status values:

```text
AVAILABLE
OCCUPIED
UNDER_REPAIR
RESERVED
VACATED_PENDING_INSPECTION
DISPUTED
INACTIVE
```

Only `AVAILABLE` quarters can be allotted.

When a quarter is allotted:

```text
Quarter status → OCCUPIED
Application status → CLOSED
Occupancy record → Active
Allotment record → Created
```

For transfer/change:

```text
Old quarter status → VACATED_PENDING_INSPECTION
New quarter status → OCCUPIED
Old occupancy record → Ended
New occupancy record → Created
Application status → CLOSED
```

---

## 7. Application Status Flow

```mermaid
flowchart TD
    A[DRAFT] --> B[SUBMITTED]
    B --> C{Duplicate Found?}
    C -->|Yes| D[DUPLICATE_REVIEW]
    C -->|No| E[ADMIN_REVIEW]
    D --> E
    E --> F[CORRESPONDENCE_REVIEW]
    F --> G[SUPER_ADMIN_REVIEW]
    G --> H[RETURNED_FOR_RECONSIDERATION]
    H --> B
    G --> I[REJECTED]
    G --> J[APPROVED_WAITLIST]
    G --> K[APPROVED_PENDING_ALLOTMENT]
    K --> L[ALLOTTED]
    L --> M[CLOSED]
    B --> N[CANCELLED]
```

---

## 8. Database Design

### 8.1 PostgreSQL Enums

```sql
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'CORRESPONDENCE_BRANCH',
  'UNIT_USER',
  'VIEWER'
);

CREATE TYPE unit_type AS ENUM (
  'POLICE_STATION',
  'BRANCH',
  'HEADQUARTER',
  'OTHER'
);

CREATE TYPE quarter_status AS ENUM (
  'AVAILABLE',
  'OCCUPIED',
  'UNDER_REPAIR',
  'RESERVED',
  'VACATED_PENDING_INSPECTION',
  'DISPUTED',
  'INACTIVE'
);

CREATE TYPE application_type AS ENUM (
  'NEW_ALLOTMENT',
  'TRANSFER_CHANGE'
);

CREATE TYPE application_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'DUPLICATE_REVIEW',
  'ADMIN_REVIEW',
  'CORRESPONDENCE_REVIEW',
  'SUPER_ADMIN_REVIEW',
  'RETURNED_FOR_RECONSIDERATION',
  'APPROVED_WAITLIST',
  'APPROVED_PENDING_ALLOTMENT',
  'ALLOTTED',
  'REJECTED',
  'CANCELLED',
  'CLOSED'
);

CREATE TYPE preference_order AS ENUM (
  'FIRST',
  'SECOND',
  'THIRD'
);

CREATE TYPE urgency_category AS ENUM (
  'MEDICAL',
  'DISABILITY',
  'WIDOW_COMPASSIONATE',
  'DISTANCE_FROM_POSTING',
  'FAMILY_SAFETY',
  'LAW_AND_ORDER_SENSITIVITY',
  'GOVERNMENT_DUTY_URGENCY',
  'EXISTING_QUARTER_UNSAFE',
  'OTHER'
);

CREATE TYPE attachment_type AS ENUM (
  'APPLICATION_LETTER',
  'SPECIAL_CASE_DOCUMENT',
  'ID_PROOF',
  'CURRENT_QUARTER_DOCUMENT',
  'OTHER'
);

CREATE TYPE approval_action AS ENUM (
  'SUBMITTED',
  'VERIFIED',
  'RETURNED',
  'REJECTED',
  'APPROVED_WAITLIST',
  'APPROVED_PENDING_ALLOTMENT',
  'ALLOTTED',
  'CANCELLED',
  'CLOSED'
);

CREATE TYPE duplicate_match_strength AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'EXACT'
);
```

---

## 9. SQL Database Tables

### 9.1 Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  police_unit_id UUID NULL,
  mobile_number VARCHAR(20),
  email VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.2 Police Units

```sql
CREATE TABLE police_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  unit_type unit_type NOT NULL,
  address TEXT,
  contact_number VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.3 Designations

```sql
CREATE TABLE designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  rank_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.4 Quarter Types

```sql
CREATE TABLE quarter_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.5 Areas

```sql
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.6 Eligibility Rules

```sql
CREATE TABLE eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_id UUID NOT NULL REFERENCES designations(id),
  quarter_type_id UUID NOT NULL REFERENCES quarter_types(id),
  is_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  requires_special_approval BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (designation_id, quarter_type_id)
);
```

### 9.7 Quarters

```sql
CREATE TABLE quarters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES areas(id),
  quarter_type_id UUID NOT NULL REFERENCES quarter_types(id),
  wing VARCHAR(50),
  block VARCHAR(50),
  floor VARCHAR(50),
  house_number VARCHAR(80) NOT NULL,
  full_quarter_code VARCHAR(150) UNIQUE,
  status quarter_status NOT NULL DEFAULT 'AVAILABLE',
  condition_remarks TEXT,
  electricity_meter_no VARCHAR(100),
  water_connection_no VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  approved_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  admin_approved_by UUID REFERENCES users(id),
  admin_approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (area_id, quarter_type_id, wing, block, floor, house_number)
);
```

### 9.8 Personnel

```sql
CREATE TABLE personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_number VARCHAR(80) NOT NULL,
  buckle_number VARCHAR(80) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  designation_id UUID NOT NULL REFERENCES designations(id),
  current_police_unit_id UUID NOT NULL REFERENCES police_units(id),
  current_address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (index_number),
  UNIQUE (buckle_number)
);
```

### 9.9 Occupancy Records

```sql
CREATE TABLE occupancy_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES personnel(id),
  quarter_id UUID NOT NULL REFERENCES quarters(id),
  allocated_date DATE NOT NULL,
  possession_date DATE NULL,
  vacated_date DATE NULL,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  allocation_reference_no VARCHAR(100),
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_one_current_quarter_per_person
ON occupancy_records (personnel_id)
WHERE is_current = TRUE;

CREATE UNIQUE INDEX ux_one_current_person_per_quarter
ON occupancy_records (quarter_id)
WHERE is_current = TRUE;
```

### 9.10 Applications

```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_no VARCHAR(100) UNIQUE NOT NULL,
  application_type application_type NOT NULL,
  personnel_id UUID NOT NULL REFERENCES personnel(id),
  submitted_by_user_id UUID NOT NULL REFERENCES users(id),
  submitted_by_unit_id UUID NOT NULL REFERENCES police_units(id),

  status application_status NOT NULL DEFAULT 'DRAFT',

  applying_for_group BOOLEAN NOT NULL DEFAULT FALSE,
  group_details TEXT,

  current_quarter_id UUID NULL REFERENCES quarters(id),
  current_quarter_text TEXT,

  reason_for_change TEXT,

  is_special_case BOOLEAN NOT NULL DEFAULT FALSE,
  special_case_category urgency_category NULL,
  special_case_reason TEXT,
  recommended_by_officer BOOLEAN NOT NULL DEFAULT FALSE,
  recommending_officer_name VARCHAR(150),
  recommending_officer_designation VARCHAR(100),

  duplicate_flag BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_summary TEXT,

  admin_remarks TEXT,
  correspondence_remarks TEXT,
  super_admin_remarks TEXT,

  submitted_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_transfer_reason
  CHECK (
    application_type != 'TRANSFER_CHANGE'
    OR reason_for_change IS NOT NULL
  ),

  CONSTRAINT chk_special_case_details
  CHECK (
    is_special_case = FALSE
    OR (
      special_case_category IS NOT NULL
      AND special_case_reason IS NOT NULL
    )
  )
);
```

### 9.11 Partial Unique Index for Active Applications

```sql
CREATE UNIQUE INDEX ux_one_active_application_per_person
ON applications (personnel_id)
WHERE status IN (
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
```

### 9.12 Application Preferences

```sql
CREATE TABLE application_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id),
  quarter_type_id UUID NOT NULL REFERENCES quarter_types(id),
  preference_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, preference_order)
);
```

### 9.13 Attachments

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  attachment_type attachment_type NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  description TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.14 Duplicate Checks

```sql
CREATE TABLE duplicate_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  matched_personnel_id UUID NULL REFERENCES personnel(id),
  matched_application_id UUID NULL REFERENCES applications(id),
  match_strength duplicate_match_strength NOT NULL,
  match_reason TEXT NOT NULL,
  match_score INTEGER NOT NULL DEFAULT 0,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP NULL,
  is_confirmed_duplicate BOOLEAN NULL,
  review_remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.15 Approval History

```sql
CREATE TABLE approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  from_status application_status NULL,
  to_status application_status NULL,
  remarks TEXT,
  acted_by UUID NOT NULL REFERENCES users(id),
  acted_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.16 Allotments

```sql
CREATE TABLE allotments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id),
  personnel_id UUID NOT NULL REFERENCES personnel(id),
  quarter_id UUID NOT NULL REFERENCES quarters(id),
  previous_quarter_id UUID NULL REFERENCES quarters(id),
  allotment_order_no VARCHAR(100) UNIQUE,
  allotment_date DATE NOT NULL,
  possession_due_date DATE NULL,
  remarks TEXT,
  approved_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.17 Quarter Status History

```sql
CREATE TABLE quarter_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter_id UUID NOT NULL REFERENCES quarters(id),
  old_status quarter_status,
  new_status quarter_status NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 9.18 Audit Logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_role user_role,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 10. Prisma Schema Requirement

The developer may either:

1. Use Prisma schema and generate migrations, or
2. Use raw SQL migrations.

If Prisma is used:

- All above tables must be represented as Prisma models.
- Enums must be represented in Prisma.
- Add indexes and unique constraints.
- For partial unique indexes, use raw SQL migration because Prisma may not fully support partial indexes directly.

---

## 11. Required Seed Data

Create seed script for:

### 11.1 Designations

| Code | Name | Rank Order |
|---|---|---:|
| LR | Lok Rakshak | 1 |
| PC | Police Constable | 2 |
| HC | Head Constable | 3 |
| ASI | Assistant Sub Inspector | 4 |
| PSI | Police Sub Inspector | 5 |
| PI | Police Inspector | 6 |
| ACP | Assistant Commissioner of Police | 7 |

### 11.2 Quarter Types

| Name |
|---|
| 1 BHK |
| 2 BHK |
| 3 BHK |

### 11.3 Areas

| Name |
|---|
| Police Headquarter |
| Ramnath Para |
| Mounted Police Line |

### 11.4 Default Eligibility

Suggested initial eligibility:

| Designation | 1 BHK | 2 BHK | 3 BHK |
|---|---:|---:|---:|
| LR | Yes | No | No |
| PC | Yes | No | No |
| HC | Yes | Yes | No |
| ASI | Yes | Yes | No |
| PSI | Yes | Yes | No |
| PI | Yes | Yes | Yes |
| ACP | Yes | Yes | No / Configurable |

Keep ACP rule configurable because final departmental policy may differ.

### 11.5 Default Admin User

Create first admin user via seed.

```text
Username: admin
Password: Admin@12345
Role: ADMIN
```

Force password change after first login if possible.

---

## 12. File Upload Requirements

### 12.1 Upload Types

| Document Type | Mandatory? | Condition |
|---|---:|---|
| Application Letter | Yes | Mandatory for every submitted application |
| Special Case Document | Conditional | Mandatory if special case is Yes |
| ID Proof | Optional | If department wants |
| Current Quarter Document | Optional | For transfer cases |
| Other | Optional | For supporting material |

### 12.2 Validation Rules

Backend must enforce:

```text
Before SUBMIT:
- At least one APPLICATION_LETTER attachment exists.
- If is_special_case = true, at least one SPECIAL_CASE_DOCUMENT exists.
- File MIME type must be PDF/JPG/JPEG/PNG.
- File size must be <= 10 MB.
```

### 12.3 File Storage

Store files on backend server:

```text
backend/uploads/application-letters/
backend/uploads/special-case-documents/
backend/uploads/other/
```

Use UUID-based stored filenames.

Example:

```text
application-letters/2026/05/uuid-file.pdf
special-case-documents/2026/05/uuid-file.pdf
```

Do not expose `/uploads` publicly as static open folder.

Files must be downloaded through protected API:

```http
GET /api/attachments/:id/download
```

The API must check:

- User is logged in.
- User role has permission.
- Unit user can access only applications submitted by own unit.
- Admin/Super Admin can access all.
- Correspondence can access application verification documents if permitted.

---

## 13. Duplicate Detection Logic

### 13.1 When to Check

Duplicate check should run:

1. While entering Index Number
2. While entering Buckle Number
3. While entering Mobile Number
4. Before saving personnel
5. Before submitting application

### 13.2 Duplicate Check API

```http
GET /api/personnel/search-duplicate?indexNumber=&buckleNumber=&mobileNumber=&name=
```

Return possible matches.

### 13.3 Match Score

| Match Condition | Score |
|---|---:|
| Exact index number match | 100 |
| Exact buckle number match | 100 |
| Exact mobile number match | 70 |
| Same name + same posting | 60 |
| Same name + same designation + mobile similarity | 50 |
| Active application exists | 100 |
| Current occupancy exists | 90 |

### 13.4 Hard Block Conditions

Block application submission when:

- Same personnel has active application.
- New allotment applicant already has current quarter.
- Transfer applicant does not have current quarter.
- Quarter type not eligible for designation.
- Required files missing.

### 13.5 Soft Warning Conditions

Show warning and send to duplicate review when:

- Mobile number matches another personnel.
- Similar name and same posting found.
- Old closed application exists.
- Previous allotment history exists.

---

## 14. Application Validation Rules

### 14.1 New Allotment Form Fields

Required:

- Index Number
- Name
- Mobile Number
- Buckle Number
- Designation
- Current Posting
- Current Address
- Applying for group? Yes/No
- Preferred Area
- Preferred Quarter Type
- Application Letter Upload

Optional / Conditional:

- Second preference
- Third preference
- Group details if group application selected
- Special case Yes/No
- Special case category if special case Yes
- Special case reason if special case Yes
- Special case documents if special case Yes
- Recommending officer details

### 14.2 Transfer / Change Form Fields

Required:

- Index Number
- Name
- Mobile Number
- Buckle Number
- Designation
- Current Posting
- Current Address
- Current Quarter
- Applying for individual/group
- Preferred Area
- Preferred Quarter Type
- Reason for change
- Application Letter Upload

Optional / Conditional:

- Second preference
- Third preference
- Group details if group application selected
- Special case Yes/No
- Special case category if special case Yes
- Special case reason if special case Yes
- Special case documents if special case Yes
- Recommending officer details

---

## 15. Backend API Specification

All API routes should be under:

```http
/api
```

### 15.1 Auth

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password
```

### 15.2 Users

```http
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
PATCH  /api/users/:id/status
POST   /api/users/:id/reset-password
```

Only Admin should create/edit users.

### 15.3 Police Units

```http
GET    /api/police-units
POST   /api/police-units
GET    /api/police-units/:id
PATCH  /api/police-units/:id
DELETE /api/police-units/:id
```

Use soft delete by setting `is_active=false`.

### 15.4 Designations

```http
GET    /api/designations
POST   /api/designations
PATCH  /api/designations/:id
```

### 15.5 Quarter Types

```http
GET    /api/quarter-types
POST   /api/quarter-types
PATCH  /api/quarter-types/:id
```

### 15.6 Areas

```http
GET    /api/areas
POST   /api/areas
PATCH  /api/areas/:id
```

### 15.7 Eligibility Rules

```http
GET   /api/eligibility-rules
POST  /api/eligibility-rules
PATCH /api/eligibility-rules/:id
GET   /api/eligibility-rules/check?designationId=&quarterTypeId=
```

### 15.8 Quarters

```http
GET    /api/quarters
POST   /api/quarters
GET    /api/quarters/:id
PATCH  /api/quarters/:id
PATCH  /api/quarters/:id/status
POST   /api/quarters/bulk-upload
GET    /api/quarters/available?areaId=&quarterTypeId=
GET    /api/quarters/summary
```

Filters:

- Area
- Quarter type
- Status
- Wing
- Block
- Floor
- House number
- Occupied by
- Available only

### 15.9 Personnel

```http
GET    /api/personnel
POST   /api/personnel
GET    /api/personnel/:id
PATCH  /api/personnel/:id
GET    /api/personnel/search-duplicate
GET    /api/personnel/by-index/:indexNumber
GET    /api/personnel/by-buckle/:buckleNumber
GET    /api/personnel/:id/current-occupancy
GET    /api/personnel/:id/application-history
```

### 15.10 Applications

```http
GET    /api/applications
POST   /api/applications
GET    /api/applications/:id
PATCH  /api/applications/:id
POST   /api/applications/:id/submit
POST   /api/applications/:id/cancel
POST   /api/applications/:id/resubmit
GET    /api/applications/:id/history
GET    /api/applications/:id/duplicates
GET    /api/applications/pending/super-admin
GET    /api/applications/pending/admin
GET    /api/applications/pending/correspondence
```

### 15.11 Attachments

```http
POST   /api/applications/:id/attachments
GET    /api/applications/:id/attachments
GET    /api/attachments/:id/download
DELETE /api/attachments/:id
PATCH  /api/attachments/:id/verify
```

Upload form field:

```text
file
```

Other body fields:

```json
{
  "attachmentType": "APPLICATION_LETTER",
  "description": "Quarter application letter"
}
```

### 15.12 Approval

```http
POST /api/applications/:id/admin-review
POST /api/applications/:id/correspondence-review
POST /api/applications/:id/super-admin/return
POST /api/applications/:id/super-admin/reject
POST /api/applications/:id/super-admin/approve-waitlist
POST /api/applications/:id/super-admin/approve-pending-allotment
POST /api/applications/:id/super-admin/allot
```

Allot request body:

```json
{
  "quarterId": "uuid",
  "allotmentDate": "2026-05-26",
  "possessionDueDate": "2026-06-10",
  "remarks": "Approved and allotted as per availability."
}
```

### 15.13 Reports

```http
GET /api/reports/quarter-availability
GET /api/reports/quarter-occupancy
GET /api/reports/pending-applications
GET /api/reports/urgent-applications
GET /api/reports/waitlist
GET /api/reports/duplicate-applications
GET /api/reports/allotment-history
GET /api/reports/application-aging
GET /api/reports/occupancy-duration
GET /api/reports/export/:reportType?format=pdf|excel|csv
```

### 15.14 Dashboard

```http
GET /api/dashboard/super-admin
GET /api/dashboard/admin
GET /api/dashboard/correspondence
GET /api/dashboard/unit
```

---

## 16. API Validation Examples

### 16.1 Create Application Request

```json
{
  "applicationType": "NEW_ALLOTMENT",
  "personnel": {
    "indexNumber": "12345",
    "buckleNumber": "B-456",
    "fullName": "ABC XYZ",
    "mobileNumber": "9999999999",
    "designationId": "uuid",
    "currentPoliceUnitId": "uuid",
    "currentAddress": "Current residential address"
  },
  "applyingForGroup": false,
  "preferences": [
    {
      "areaId": "uuid",
      "quarterTypeId": "uuid",
      "preferenceOrder": 1
    }
  ],
  "isSpecialCase": false
}
```

### 16.2 Transfer Application Request

```json
{
  "applicationType": "TRANSFER_CHANGE",
  "personnelId": "uuid",
  "currentQuarterId": "uuid",
  "reasonForChange": "Current quarter is far from present posting.",
  "applyingForGroup": false,
  "preferences": [
    {
      "areaId": "uuid",
      "quarterTypeId": "uuid",
      "preferenceOrder": 1
    }
  ],
  "isSpecialCase": true,
  "specialCaseCategory": "MEDICAL",
  "specialCaseReason": "Medical treatment requires nearby accommodation.",
  "recommendedByOfficer": true,
  "recommendingOfficerName": "Officer Name",
  "recommendingOfficerDesignation": "PI"
}
```

---

## 17. Frontend Pages

### 17.1 Public / Auth Pages

- Login page
- Forgot password page, optional
- Change password page

### 17.2 Common Layout

- Sidebar menu based on role
- Top header with logged-in user
- Notification icon
- Profile/change password
- Breadcrumbs
- Role-based route protection

### 17.3 Super Admin Pages

- Super Admin Dashboard
- Pending applications
- Urgent/special case applications
- Application detail view
- Available quarter selection screen
- Return/reject/approve/allot modal
- Allotment history
- Reports

### 17.4 Admin Pages

- Admin Dashboard
- User management
- Police Station / Branch management
- Designation management
- Area management
- Quarter type management
- Eligibility rule management
- Quarter inventory
- Duplicate application review
- Correspondence entry approval
- Reports
- Audit logs

### 17.5 Correspondence Branch Pages

- Correspondence Dashboard
- Quarter inventory view
- Add occupied quarter
- Add vacant quarter
- Update quarter status
- Occupancy records
- Application verification queue
- Vacancy report
- Occupancy report

### 17.6 Station / Branch User Pages

- Unit Dashboard
- New application form
- Transfer/change application form
- My unit applications
- Returned applications
- Application status view
- Upload missing documents
- Download acknowledgement

### 17.7 Viewer Pages

- Dashboard
- Read-only reports
- Read-only quarter summary
- Read-only application search

---

## 18. Important UI Form Behavior

### 18.1 Personnel Lookup

When user enters:

- Index Number
- Buckle Number
- Mobile Number

Frontend should automatically call duplicate/personnel search API and show:

```text
Existing personnel found
Existing quarter found
Active application found
Previous closed application found
```

### 18.2 Application Type Auto-Control

If personnel already has active quarter:

- Disable `New Allotment`
- Allow only `Transfer / Change`

If personnel has no active quarter:

- Allow `New Allotment`
- Disable `Transfer / Change`

If active application exists:

- Disable new submission
- Show active application details

### 18.3 Special Case UI

If user selects Special Case = Yes:

Show mandatory fields:

- Special case category
- Special case reason
- Upload special case document
- Recommending officer details

Submit button must remain disabled until required files are uploaded.

### 18.4 Attachment Upload UI

Every application form must include:

```text
Upload Quarter Application Letter *
```

Accepted files:

```text
.pdf, .jpg, .jpeg, .png
```

Special case section:

```text
Upload Special Case Supporting Document *
```

Only show when special case is selected.

---

## 19. Dashboard Requirements

### 19.1 Super Admin Dashboard Cards

- Total pending applications
- Urgent/special applications
- New allotment requests
- Transfer/change requests
- Available quarters
- Occupied quarters
- Applications pending more than 15 days
- Waitlisted applications

Tables:

- Urgent applications first
- Pending final approval
- Available quarter summary by area/type

### 19.2 Admin Dashboard Cards

- Total users
- Total police units
- Total quarters
- Duplicate cases pending
- Correspondence records pending approval
- Active applications
- Rejected/returned applications

### 19.3 Correspondence Dashboard Cards

- Total quarters
- Available quarters
- Occupied quarters
- Under repair quarters
- Vacated pending inspection
- Pending verification applications

### 19.4 Unit Dashboard Cards

- Applications submitted by unit
- Pending applications
- Returned applications
- Approved/allotted applications
- Rejected applications

---

## 20. Reports

### 20.1 Quarter Availability Report

Columns:

- Area
- Quarter type
- Total quarters
- Available
- Occupied
- Under repair
- Reserved
- Vacated pending inspection

### 20.2 Occupancy Report

Columns:

- Quarter code
- Area
- Type
- Wing
- Block
- Floor
- House number
- Resident name
- Designation
- Buckle number
- Posting
- Allocated date
- Occupancy duration

### 20.3 Pending Application Report

Columns:

- Application number
- Application type
- Personnel name
- Designation
- Posting
- Requested area/type
- Special case yes/no
- Current status
- Pending since
- Pending at role

### 20.4 Urgent Application Report

Columns:

- Application number
- Personnel name
- Designation
- Unit
- Urgency category
- Reason summary
- Supporting document status
- Current status
- Pending since

### 20.5 Duplicate Application Report

Columns:

- Application number
- Personnel name
- Duplicate reason
- Match strength
- Match score
- Matched personnel/application
- Review status

### 20.6 Allotment History Report

Columns:

- Allotment order no
- Application number
- Personnel name
- Designation
- Quarter allotted
- Area
- Type
- Allotment date
- Approved by

---

## 21. Allotment Order Generation

After Super Admin allots quarter, system should generate PDF order.

Fields:

- Allotment order number
- Date
- Applicant name
- Designation
- Buckle number
- Index number
- Current posting
- Quarter area
- Quarter type
- Wing
- Block
- Floor
- House number
- Allotment date
- Possession due date
- Approving authority
- Remarks
- Terms and conditions

PDF should be downloadable only by authorized users.

Suggested endpoint:

```http
GET /api/applications/:id/allotment-order/pdf
```

---

## 22. Security Requirements

Minimum requirements:

- Passwords hashed using bcrypt.
- JWT access token with expiration.
- Refresh token or session strategy.
- Role-based API access.
- Frontend route guards.
- Rate limit login attempts.
- File upload MIME validation.
- File upload size validation.
- Do not expose upload folder publicly.
- Use HTTPS in production.
- Add audit log for every create/update/delete/approval/allotment action.
- Unit users can see only their own unit's applications.
- Viewer cannot edit anything.
- Soft delete master data instead of permanent delete.
- Environment variables must not be committed to Git.

---

## 23. Audit Log Rules

Create audit log for:

- Login success/failure
- User creation/update
- Password reset
- Police unit creation/update
- Quarter creation/update/status change
- Occupancy record creation/update
- Application creation/update/submit/resubmit/cancel
- Attachment upload/delete/verify
- Duplicate review action
- Admin review action
- Correspondence review action
- Super Admin return/reject/approve/allot
- Report export

Audit log must store:

- User ID
- User role
- Action
- Entity type
- Entity ID
- Old value JSON
- New value JSON
- IP address
- User agent
- Timestamp

---

## 24. Critical Backend Services

### 24.1 Eligibility Service

Function:

```ts
checkEligibility(designationId: string, quarterTypeId: string): Promise<EligibilityResult>
```

Return:

```ts
{
  eligible: boolean;
  requiresSpecialApproval: boolean;
  reason?: string;
}
```

### 24.2 Duplicate Service

Function:

```ts
checkApplicationDuplicates(input: DuplicateCheckInput): Promise<DuplicateResult[]>
```

Must check:

- Personnel table
- Occupancy records
- Active applications
- Similar name/mobile combinations

### 24.3 Application Submit Service

Function:

```ts
submitApplication(applicationId: string, userId: string): Promise<Application>
```

Must validate:

- Personnel exists
- Application has preferences
- Eligibility is valid
- Duplicate hard blocks are clear
- Application letter exists
- Special case document exists if special case is true
- Correct status transition

### 24.4 Allotment Service

Function:

```ts
allotQuarter(applicationId: string, quarterId: string, approvedBy: string): Promise<Allotment>
```

Must be transactional.

Transaction steps:

1. Lock application row.
2. Lock quarter row.
3. Verify application status.
4. Verify quarter status is `AVAILABLE`.
5. Verify eligibility.
6. If transfer, close old occupancy record.
7. If transfer, mark old quarter `VACATED_PENDING_INSPECTION`.
8. Mark new quarter `OCCUPIED`.
9. Create new occupancy record.
10. Create allotment record.
11. Update application status to `CLOSED`.
12. Insert approval history.
13. Insert audit logs.

Use database transaction to prevent double allotment.

---

## 25. PostgreSQL Transaction Requirement for Allotment

Pseudo-code:

```ts
await prisma.$transaction(async (tx) => {
  const application = await tx.applications.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found");

  const quarter = await tx.quarters.findUnique({ where: { id: quarterId } });
  if (!quarter || quarter.status !== "AVAILABLE") {
    throw new Error("Quarter is not available");
  }

  if (application.application_type === "TRANSFER_CHANGE") {
    await tx.occupancy_records.updateMany({
      where: {
        personnel_id: application.personnel_id,
        is_current: true
      },
      data: {
        is_current: false,
        vacated_date: new Date()
      }
    });

    if (application.current_quarter_id) {
      await tx.quarters.update({
        where: { id: application.current_quarter_id },
        data: { status: "VACATED_PENDING_INSPECTION" }
      });
    }
  }

  await tx.quarters.update({
    where: { id: quarterId },
    data: { status: "OCCUPIED" }
  });

  await tx.occupancy_records.create({
    data: {
      personnel_id: application.personnel_id,
      quarter_id: quarterId,
      allocated_date: new Date(),
      is_current: true
    }
  });

  await tx.allotments.create({
    data: {
      application_id: applicationId,
      personnel_id: application.personnel_id,
      quarter_id: quarterId,
      previous_quarter_id: application.current_quarter_id,
      allotment_date: new Date(),
      approved_by: approvedBy
    }
  });

  await tx.applications.update({
    where: { id: applicationId },
    data: {
      status: "CLOSED",
      closed_at: new Date()
    }
  });
});
```

---

## 26. Frontend Validation Schema Example

Use Zod.

```ts
const applicationSchema = z.object({
  applicationType: z.enum(["NEW_ALLOTMENT", "TRANSFER_CHANGE"]),
  indexNumber: z.string().min(1, "Index number is required"),
  buckleNumber: z.string().min(1, "Buckle number is required"),
  fullName: z.string().min(2, "Name is required"),
  mobileNumber: z.string().min(10, "Valid mobile number is required"),
  designationId: z.string().uuid(),
  currentPoliceUnitId: z.string().uuid(),
  currentAddress: z.string().min(5, "Current address is required"),

  currentQuarterId: z.string().uuid().optional(),
  reasonForChange: z.string().optional(),

  preferences: z.array(
    z.object({
      areaId: z.string().uuid(),
      quarterTypeId: z.string().uuid(),
      preferenceOrder: z.number().min(1).max(3)
    })
  ).min(1),

  isSpecialCase: z.boolean(),
  specialCaseCategory: z.string().optional(),
  specialCaseReason: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.applicationType === "TRANSFER_CHANGE" && !data.reasonForChange) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reason for change is required",
      path: ["reasonForChange"]
    });
  }

  if (data.isSpecialCase && !data.specialCaseCategory) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Special case category is required",
      path: ["specialCaseCategory"]
    });
  }

  if (data.isSpecialCase && !data.specialCaseReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Special case reason is required",
      path: ["specialCaseReason"]
    });
  }
});
```

---

## 27. Status Transition Rules

Create a backend status transition guard.

Allowed transitions:

```text
DRAFT → SUBMITTED
SUBMITTED → DUPLICATE_REVIEW
SUBMITTED → ADMIN_REVIEW
DUPLICATE_REVIEW → ADMIN_REVIEW
DUPLICATE_REVIEW → REJECTED
ADMIN_REVIEW → CORRESPONDENCE_REVIEW
ADMIN_REVIEW → RETURNED_FOR_RECONSIDERATION
ADMIN_REVIEW → REJECTED
CORRESPONDENCE_REVIEW → SUPER_ADMIN_REVIEW
CORRESPONDENCE_REVIEW → RETURNED_FOR_RECONSIDERATION
SUPER_ADMIN_REVIEW → RETURNED_FOR_RECONSIDERATION
SUPER_ADMIN_REVIEW → REJECTED
SUPER_ADMIN_REVIEW → APPROVED_WAITLIST
SUPER_ADMIN_REVIEW → APPROVED_PENDING_ALLOTMENT
APPROVED_PENDING_ALLOTMENT → ALLOTTED
ALLOTTED → CLOSED
RETURNED_FOR_RECONSIDERATION → SUBMITTED
DRAFT → CANCELLED
SUBMITTED → CANCELLED
```

Do not allow random status updates from frontend.

---

## 28. Search and Filter Requirements

Applications list filters:

- Application number
- Application type
- Status
- Personnel name
- Index number
- Buckle number
- Mobile number
- Designation
- Police unit
- Area preference
- Quarter type preference
- Special case yes/no
- Date range
- Pending more than X days

Quarters list filters:

- Area
- Quarter type
- Status
- Wing
- Block
- Floor
- House number
- Resident name
- Resident buckle number
- Available only

Personnel filters:

- Name
- Index number
- Buckle number
- Mobile
- Designation
- Police unit
- Has current quarter yes/no

---

## 29. Bulk Upload Requirements

### 29.1 Quarter Bulk Upload

Support Excel/CSV upload with columns:

```text
Area
Quarter Type
Wing
Block
Floor
House Number
Status
Condition Remarks
Electricity Meter No
Water Connection No
Resident Index Number
Resident Buckle Number
Resident Name
Resident Mobile Number
Resident Designation
Resident Posting
Allocated Date
```

Rules:

- If status is occupied, resident details are mandatory.
- If resident does not exist, create personnel record.
- If quarter does not exist, create quarter.
- Correspondence Branch upload should remain pending Admin approval.
- Admin upload may directly approve.

### 29.2 Validation Output

After upload, show:

- Total rows
- Valid rows
- Invalid rows
- Duplicate quarters
- Duplicate personnel
- Missing fields
- Rows imported
- Rows skipped

---

## 30. Error Handling

All API errors should return consistent structure:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "indexNumber",
      "message": "Index number is required"
    }
  ]
}
```

Successful response:

```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {}
}
```

---

## 31. Notification Suggestions

MVP can use in-app notifications only.

Trigger notifications when:

- Application submitted
- Application returned
- Application rejected
- Application approved
- Quarter allotted
- Document missing
- Duplicate detected
- Admin approval required
- Correspondence verification required

Future options:

- SMS
- Email
- WhatsApp integration

---

## 32. Acceptance Criteria

### 32.1 Application Submission

- User can submit new allotment application only after mandatory application letter upload.
- Special case application cannot be submitted without supporting document.
- Duplicate active application is blocked.
- Existing quarter holder cannot apply for new allotment.
- Non-quarter holder cannot apply for transfer/change.
- Ineligible quarter type is blocked.

### 32.2 Quarter Allotment

- Super Admin can select only available quarters.
- Once allotted, quarter becomes occupied.
- Occupancy record is created.
- Application becomes closed.
- Allotment record is created.
- Audit log is created.
- Allotment order PDF can be generated.

### 32.3 Transfer Case

- Old quarter becomes `VACATED_PENDING_INSPECTION`.
- New quarter becomes `OCCUPIED`.
- Old occupancy ends.
- New occupancy starts.
- Application is closed.

### 32.4 Role-Based Access

- Unit user sees only own unit applications.
- Correspondence user can update quarter records but changes need Admin approval if configured.
- Admin can manage masters and users.
- Super Admin can approve/reject/allot.
- Viewer cannot modify data.

---

## 33. Testing Checklist

### 33.1 Auth

- Login with valid credentials
- Login with invalid credentials
- Role-based route access
- Token expiry
- Password reset/change

### 33.2 Master Data

- Create/edit police unit
- Create/edit designation
- Create/edit area
- Create/edit quarter type
- Create/edit eligibility rule

### 33.3 Quarter Inventory

- Add available quarter
- Add occupied quarter
- Change status
- Prevent duplicate house number in same area/type/block/floor
- Bulk upload valid file
- Bulk upload invalid file

### 33.4 Application

- Submit new allotment
- Submit transfer/change
- Submit without application letter: should fail
- Submit special case without document: should fail
- Submit duplicate active application: should fail
- Submit ineligible quarter type: should fail
- Resubmit returned application

### 33.5 Approval

- Admin verify
- Correspondence verify
- Super Admin return
- Super Admin reject
- Super Admin approve waitlist
- Super Admin allot quarter

### 33.6 Reports

- Quarter availability report
- Occupancy report
- Pending application report
- Urgent application report
- Duplicate report
- Export PDF/Excel/CSV

---

## 34. Recommended Development Phases

### Phase 1: Foundation

- Backend setup
- Frontend setup
- PostgreSQL connection
- Authentication
- Role-based permissions
- Master data modules

### Phase 2: Quarter Inventory

- Area/type/quarter CRUD
- Quarter status management
- Occupancy records
- Basic reports

### Phase 3: Application System

- Personnel module
- New application form
- Transfer application form
- File upload
- Duplicate checks
- Eligibility checks

### Phase 4: Approval Workflow

- Admin review
- Correspondence review
- Super Admin review
- Return/reject/approve
- Quarter allotment transaction

### Phase 5: Reports and PDF

- All dashboards
- Reports
- Export
- Allotment order PDF
- Application acknowledgement PDF

### Phase 6: Hardening

- Audit logs
- File access control
- Error handling
- Testing
- Deployment
- Backup

---

## 35. Deployment Notes

### 35.1 Backend Environment

```env
NODE_ENV=production
PORT=5000

DATABASE_URL="postgresql://postgress:xyz@localhost:5566/police_quarter_allocation?schema=public"

JWT_SECRET="change-this-to-long-random-secret"
JWT_EXPIRES_IN="1h"

UPLOAD_ROOT="./uploads"
MAX_FILE_SIZE_MB=10

APP_BASE_URL="http://localhost:5173"
API_BASE_URL="http://localhost:5000/api"
```

### 35.2 Frontend Environment

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### 35.3 Production Recommendations

- Use Nginx reverse proxy.
- Use HTTPS certificate.
- Store uploads outside public web root.
- Enable daily PostgreSQL backup.
- Enable log rotation.
- Use PM2 or systemd for backend service.
- Use database migration system.
- Restrict database access to localhost.
- Create separate database user with limited permissions.

---

## 36. Backup Requirements

Daily backup:

```bash
pg_dump -h localhost -p 5566 -U postgress police_quarter_allocation > backup_$(date +%F).sql
```

Also backup:

```text
backend/uploads/
```

Minimum backup policy:

- Daily database backup
- Weekly full backup including uploads
- Keep last 30 days
- Store one copy outside server

---

## 37. Future Enhancements

Do not build these in MVP unless specifically requested:

- Mobile app
- SMS notification
- WhatsApp notification
- Digital signature
- Aadhaar/PAN integration
- Biometric login
- GIS map of quarter locations
- AI-based priority recommendation
- Public applicant portal
- Occupancy inspection mobile app
- QR code on allotment order

---

## 38. Final Build Instruction for AI Developer

Build the application as a secure, role-based administrative workflow system.

Priority order:

1. Correct database design
2. Strict role permissions
3. Mandatory document validation
4. Duplicate prevention
5. Quarter eligibility rules
6. Approval workflow
7. Allotment transaction safety
8. Audit logs
9. Reports
10. Clean admin UI

Do not make quarter allotment a simple form submission. It must be a controlled workflow with clear status transitions, verification, approval, and audit history.

The most critical rule:

```text
No quarter should become occupied unless Super Admin allots a specific AVAILABLE quarter through the approval workflow.
```
