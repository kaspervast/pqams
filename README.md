# Police Quarter Allocation Management System (PQAMS)

Role-based quarter inventory, application review, and allotment workflow built with Express, React, Prisma, and PostgreSQL.

## Local Runtime

Prerequisites:

- Node.js 22+
- PostgreSQL available on `localhost:5566`
- PostgreSQL user `postgres` with a locally configured password

The application is configured to use:

```text
http://localhost:3120
postgresql://postgres:<your-password>@localhost:5566/police_quarter_allocation
```

Commands:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

For a compiled run:

```bash
npm run build
npm start
```

`backend/.env` is local-only and ignored. Change secrets before non-local deployment.

## Bootstrap Users

All seeded users initially use password `Admin@12345` and must change it on first login.

| Username | Role |
| --- | --- |
| `admin` | Administrator |
| `superadmin` | Super Admin |
| `correspondence` | Correspondence Branch |
| `unituser` | Unit User |
| `viewer` | Viewer / Audit |

## Capabilities

- Admin user, police unit, designation, area, quarter type, and rank eligibility management.
- Quarter inventory, controlled legacy occupancy entry, correspondence approval queue, and CSV/XLSX import.
- Unit application submission with transfer/new-allotment auto-control, three preferences, compulsory application letter, and special-case evidence.
- Duplicate review, Admin review, Correspondence verification, Super Admin final decision, waitlist, and transactional allotment.
- Private attachment delivery, allotment and acknowledgement PDFs, notifications, dashboards, reports and CSV/XLSX/PDF exports.
- JWT and refresh sessions, forced password change, role scoping, login rate limit, audit logs, and database constraints preventing duplicate active applications or occupancy.

## Quarter Import

Imports accept `.csv` or `.xlsx` with headings from the specification. For an `OCCUPIED` row, provide:

```text
Resident Index Number, Resident Buckle Number, Resident Name,
Resident Mobile Number, Resident Designation, Resident Posting, Allocated Date
```

Admin imports apply immediately. Correspondence imports create a pending request for Admin approval.

## Validation

```bash
npm run build
npm test
```
