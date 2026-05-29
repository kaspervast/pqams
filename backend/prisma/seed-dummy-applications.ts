import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  ApplicationStatus,
  ApplicationType,
  ApprovalAction,
  AttachmentType,
  PrismaClient,
  QuarterStatus,
  UrgencyCategory,
  UserRole
} from "@prisma/client";

const prisma = new PrismaClient();
const seedPassword = "Test@12345";
const seedPrefix = "DAPP";
const seedDate = new Date("2026-05-01T03:30:00.000Z");

type AvailableOption = {
  areaId: string;
  areaName: string;
  quarterTypeId: string;
  quarterTypeName: string;
};

function hash(value: string) {
  let output = 2166136261;
  for (const character of value) {
    output ^= character.charCodeAt(0);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function pick<T>(values: T[], key: string): T {
  if (!values.length) throw new Error(`No seed options available for ${key}`);
  return values[hash(key) % values.length]!;
}

function dummyPdf(title: string) {
  const content = `BT /F1 16 Tf 72 720 Td (${title}) Tj 0 -30 Td (Generated dummy test document for PQAMS) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >> stream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj ${object} endobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

function createDocumentFixtures() {
  const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const fixtureRoot = resolve(backendRoot, "uploads", "dummy-applications");
  mkdirSync(fixtureRoot, { recursive: true });
  const letterPath = resolve(fixtureRoot, "dummy-application-letter.pdf");
  const specialPath = resolve(fixtureRoot, "dummy-special-case-document.pdf");
  if (!existsSync(letterPath)) writeFileSync(letterPath, dummyPdf("Dummy Application Letter"));
  if (!existsSync(specialPath)) writeFileSync(specialPath, dummyPdf("Dummy Special Case Evidence"));
  return { letterPath, specialPath };
}

function uniquePreferences(primary: AvailableOption, eligible: AvailableOption[], key: string) {
  const alternatives = eligible.filter((option) => option.areaId !== primary.areaId || option.quarterTypeId !== primary.quarterTypeId);
  const preferenceCount = 1 + (hash(`${key}:preference-count`) % Math.min(3, 1 + alternatives.length));
  const output = [primary];
  while (output.length < preferenceCount) {
    const candidate = pick(alternatives, `${key}:preference:${output.length}`);
    if (!output.some((option) => option.areaId === candidate.areaId && option.quarterTypeId === candidate.quarterTypeId)) {
      output.push(candidate);
    } else {
      const unused = alternatives.find((option) => !output.some((selected) => selected.areaId === option.areaId && selected.quarterTypeId === option.quarterTypeId));
      if (!unused) break;
      output.push(unused);
    }
  }
  return output;
}

async function main() {
  const documents = createDocumentFixtures();
  const [admin, units, availableQuarters, eligibleRules] = await Promise.all([
    prisma.user.findUnique({ where: { username: "admin" } }),
    prisma.policeUnit.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { users: { where: { role: UserRole.UNIT_USER, isActive: true } } } }),
    prisma.quarter.findMany({
      where: { isActive: true, approvedByAdmin: true, status: QuarterStatus.AVAILABLE },
      include: { area: true, quarterType: true }
    }),
    prisma.eligibilityRule.findMany({
      where: { isEligible: true, designation: { isActive: true }, quarterType: { isActive: true } },
      include: { designation: true, quarterType: true }
    })
  ]);
  if (!admin) throw new Error("Missing admin user. Run npm run db:seed first.");
  if (!units.length) throw new Error("No active police units found. Run npm run db:seed first.");
  if (!availableQuarters.length) throw new Error("No available approved quarters found. Run npm run db:seed:dummy first.");

  const availableOptions = [...new Map(availableQuarters.map((quarter) => [
    `${quarter.areaId}:${quarter.quarterTypeId}`,
    {
      areaId: quarter.areaId,
      areaName: quarter.area.name,
      quarterTypeId: quarter.quarterTypeId,
      quarterTypeName: quarter.quarterType.name
    }
  ])).values()];
  const usableRules = eligibleRules.filter((rule) => availableOptions.some((option) => option.quarterTypeId === rule.quarterTypeId));
  if (!usableRules.length) throw new Error("No designation has eligible available seeded inventory.");

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  let createdUsers = 0;
  let createdApplications = 0;
  let createdSpecialCases = 0;
  let sequence = 0;
  const plannedPerUnit: Array<{ unit: string; applications: number }> = [];

  for (const [unitIndex, unit] of units.entries()) {
    const unitUser = unit.users[0] ?? await prisma.user.upsert({
      where: { username: `testunit${String(unitIndex + 1).padStart(3, "0")}` },
      update: { fullName: `Test Unit User ${String(unitIndex + 1).padStart(3, "0")}`, role: UserRole.UNIT_USER, policeUnitId: unit.id, isActive: true, mustChangePassword: false },
      create: {
        fullName: `Test Unit User ${String(unitIndex + 1).padStart(3, "0")}`,
        username: `testunit${String(unitIndex + 1).padStart(3, "0")}`,
        passwordHash,
        role: UserRole.UNIT_USER,
        policeUnitId: unit.id,
        mustChangePassword: false
      }
    });
    if (!unit.users.length) createdUsers += 1;

    const applicationCount = 2 + (hash(unit.name) % 4);
    plannedPerUnit.push({ unit: unit.name, applications: applicationCount });

    for (let localIndex = 0; localIndex < applicationCount; localIndex += 1) {
      sequence += 1;
      const serial = String(sequence).padStart(4, "0");
      const applicationNo = `${seedPrefix}-2026-${serial}`;
      if (await prisma.application.findUnique({ where: { applicationNo }, select: { id: true } })) continue;

      const rule = pick(usableRules, `${unit.id}:${localIndex}:rule`);
      const eligibleOptions = availableOptions.filter((option) =>
        eligibleRules.some((candidate) =>
          candidate.designationId === rule.designationId &&
          candidate.quarterTypeId === option.quarterTypeId
        )
      );
      const primary = pick(eligibleOptions.filter((option) => option.quarterTypeId === rule.quarterTypeId), `${unit.id}:${localIndex}:primary`);
      const preferences = uniquePreferences(primary, eligibleOptions, `${unit.id}:${localIndex}`);
      const isSpecialCase = sequence % 11 === 0;
      const submittedAt = new Date(seedDate.valueOf() + sequence * 60_000);
      const indexNumber = `${seedPrefix}-IDX-${serial}`;
      const buckleNumber = `${seedPrefix}-BKL-${serial}`;

      await prisma.$transaction(async (tx) => {
        const personnel = await tx.personnel.create({
          data: {
            indexNumber,
            buckleNumber,
            fullName: `Test Applicant ${serial}`,
            mobileNumber: `8${String(100000000 + sequence).padStart(9, "0")}`,
            designationId: rule.designationId,
            currentPoliceUnitId: unit.id,
            currentAddress: `Test Address ${serial}, Rajkot`,
            serviceJoinDate: new Date(Date.UTC(2008 + (sequence % 14), sequence % 12, 1 + (sequence % 24))),
            lastPostingOutsideRajkot: sequence % 7 === 0 ? "Ahmedabad City" : null,
            createdById: unitUser.id
          }
        });
        const application = await tx.application.create({
          data: {
            applicationNo,
            applicationType: ApplicationType.NEW_ALLOTMENT,
            personnelId: personnel.id,
            submittedByUserId: unitUser.id,
            submittedByUnitId: unit.id,
            status: ApplicationStatus.ADMIN_REVIEW,
            isSpecialCase,
            specialCaseCategory: isSpecialCase ? UrgencyCategory.MEDICAL : null,
            specialCaseReason: isSpecialCase ? "Seeded medical priority case for workflow testing" : null,
            submittedAt,
            preferences: {
              create: preferences.map((preference, index) => ({
                areaId: preference.areaId,
                quarterTypeId: preference.quarterTypeId,
                preferenceOrder: index + 1
              }))
            }
          }
        });
        await tx.attachment.create({
          data: {
            applicationId: application.id,
            uploadedByUserId: unitUser.id,
            attachmentType: AttachmentType.APPLICATION_LETTER,
            originalFileName: "dummy-application-letter.pdf",
            storedFileName: "dummy-application-letter.pdf",
            filePath: documents.letterPath,
            mimeType: "application/pdf",
            fileSizeBytes: BigInt(dummyPdf("Dummy Application Letter").length),
            description: "Generated test application letter"
          }
        });
        if (isSpecialCase) {
          await tx.attachment.create({
            data: {
              applicationId: application.id,
              uploadedByUserId: unitUser.id,
              attachmentType: AttachmentType.SPECIAL_CASE_DOCUMENT,
              originalFileName: "dummy-special-case-document.pdf",
              storedFileName: "dummy-special-case-document.pdf",
              filePath: documents.specialPath,
              mimeType: "application/pdf",
              fileSizeBytes: BigInt(dummyPdf("Dummy Special Case Evidence").length),
              description: "Generated test special-case evidence"
            }
          });
        }
        await tx.approvalHistory.createMany({
          data: [
            {
              applicationId: application.id,
              action: ApprovalAction.SUBMITTED,
              fromStatus: ApplicationStatus.DRAFT,
              toStatus: ApplicationStatus.SUBMITTED,
              remarks: "Seeded submission",
              actedById: unitUser.id,
              actedAt: submittedAt
            },
            {
              applicationId: application.id,
              action: ApprovalAction.VERIFIED,
              fromStatus: ApplicationStatus.SUBMITTED,
              toStatus: ApplicationStatus.ADMIN_REVIEW,
              remarks: "Seeded application passed automatic validation",
              actedById: unitUser.id,
              actedAt: submittedAt
            }
          ]
        });
      });
      createdApplications += 1;
      if (isSpecialCase) createdSpecialCases += 1;
    }
  }

  const targets = plannedPerUnit.reduce((total, item) => total + item.applications, 0);
  console.log(`Dummy application target: ${targets} submitted applications across ${units.length} active units.`);
  console.log(`This run created: ${createdApplications} applications (${createdSpecialCases} special cases) and ${createdUsers} unit-user test login(s).`);
  console.log(`Unit test account password: ${seedPassword}`);
  console.table(plannedPerUnit);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
