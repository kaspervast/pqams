import "dotenv/config";
import { PrismaClient, QuarterStatus } from "@prisma/client";

const prisma = new PrismaClient();

type EstatePlan = {
  name: string;
  code: string;
  areaName: string;
  quarterType: "B" | "C";
  blocks: string[];
  floors: number;
  housesPerFloor: number;
  occupancyRate: number;
};

type PlannedQuarter = {
  plan: EstatePlan;
  block: string;
  floor: number;
  house: number;
  fullQuarterCode: string;
  occupied: boolean;
};

const plans: EstatePlan[] = [
  {
    name: "C7-C9 Officer Quarters",
    code: "PHQ",
    areaName: "Police Headquarter",
    quarterType: "C",
    blocks: ["C7", "C8", "C9"],
    floors: 10,
    housesPerFloor: 4,
    occupancyRate: 0.70
  },
  {
    name: "Char Maliya",
    code: "CM",
    areaName: "Char Maliya",
    quarterType: "B",
    blocks: Array.from({ length: 16 }, (_, index) => `B${index + 1}`),
    floors: 4,
    housesPerFloor: 4,
    occupancyRate: 0.80
  },
  {
    name: "Maruti Nagar",
    code: "MN",
    areaName: "Police Headquarter",
    quarterType: "B",
    blocks: Array.from({ length: 20 }, (_, index) => `B${index + 1}`),
    floors: 4,
    housesPerFloor: 4,
    occupancyRate: 0.72
  },
  {
    name: "Ramnath Para",
    code: "RP",
    areaName: "Ramnath Para",
    quarterType: "B",
    blocks: Array.from({ length: 7 }, (_, index) => `B${index + 1}`),
    floors: 4,
    housesPerFloor: 4,
    occupancyRate: 0.40
  },
  {
    name: "Mounted Police Line Officer Quarters",
    code: "MPL",
    areaName: "Mounted Police Line",
    quarterType: "C",
    blocks: ["B1", "B2"],
    floors: 10,
    housesPerFloor: 4,
    occupancyRate: 0.60
  },
  {
    name: "Mounted Police Line General Quarters",
    code: "MPL",
    areaName: "Mounted Police Line",
    quarterType: "B",
    blocks: ["B3", "B4", "B5", "B6"],
    floors: 10,
    housesPerFloor: 4,
    occupancyRate: 0.49
  }
];

function buildQuarterPlan(plan: EstatePlan): PlannedQuarter[] {
  const total = plan.blocks.length * plan.floors * plan.housesPerFloor;
  const occupiedCount = Math.round(total * plan.occupancyRate);
  const quarters: PlannedQuarter[] = [];
  let position = 0;

  for (const block of plan.blocks) {
    for (let floor = 1; floor <= plan.floors; floor += 1) {
      for (let house = 1; house <= plan.housesPerFloor; house += 1) {
        const before = Math.floor((position * occupiedCount) / total);
        const after = Math.floor(((position + 1) * occupiedCount) / total);
        const fullQuarterCode = `${plan.code}-${block}-F${String(floor).padStart(2, "0")}-Q${String(house).padStart(2, "0")}`;
        quarters.push({ plan, block, floor, house, fullQuarterCode, occupied: after > before });
        position += 1;
      }
    }
  }
  return quarters;
}

function requireRecord<T>(value: T | undefined, description: string): T {
  if (!value) throw new Error(`Missing ${description}. Run npm run db:seed first.`);
  return value;
}

async function main() {
  const generated = plans.flatMap(buildQuarterPlan);
  const [admin, quarterTypes, designations, units] = await Promise.all([
    prisma.user.findUnique({ where: { username: "admin" } }),
    prisma.quarterType.findMany(),
    prisma.designation.findMany(),
    prisma.policeUnit.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  ]);

  const actor = requireRecord(admin ?? undefined, "admin account");
  if (!units.length) throw new Error("No active police units found. Run npm run db:seed first.");

  const typeByName = new Map(quarterTypes.map((type) => [type.name, type]));
  const designationByCode = new Map(designations.map((designation) => [designation.code, designation]));
  const officerType = requireRecord(typeByName.get("C"), "C quarter type");
  const allowedOfficerType = new Set(["PSI", "PI"]);

  for (const designation of designations) {
    await prisma.eligibilityRule.upsert({
      where: { designationId_quarterTypeId: { designationId: designation.id, quarterTypeId: officerType.id } },
      update: {
        isEligible: allowedOfficerType.has(designation.code),
        remarks: allowedOfficerType.has(designation.code)
          ? "Eligible for seeded officer-category C inventory"
          : "C officer-category inventory restricted to PSI and PI"
      },
      create: {
        designationId: designation.id,
        quarterTypeId: officerType.id,
        isEligible: allowedOfficerType.has(designation.code),
        remarks: allowedOfficerType.has(designation.code)
          ? "Eligible for seeded officer-category C inventory"
          : "C officer-category inventory restricted to PSI and PI"
      }
    });
  }

  const areaNames = [...new Set(plans.map((plan) => plan.areaName))];
  const areas = new Map<string, { id: string }>();
  for (const name of areaNames) {
    const area = await prisma.area.upsert({ where: { name }, update: { isActive: true }, create: { name } });
    areas.set(name, area);
  }

  const existingCodes = new Set((await prisma.quarter.findMany({
    where: { fullQuarterCode: { in: generated.map((quarter) => quarter.fullQuarterCode) } },
    select: { fullQuarterCode: true }
  })).map((quarter) => quarter.fullQuarterCode).filter((code): code is string => Boolean(code)));

  const generalResidentRanks = ["HC", "ASI", "PSI", "PI", "ACP"];
  const officerTypeResidentRanks = ["PSI", "PI"];
  let created = 0;
  let occupiedCreated = 0;
  let residentSequence = await prisma.personnel.count({ where: { indexNumber: { startsWith: "DUMMY-" } } });

  for (const planned of generated) {
    if (existingCodes.has(planned.fullQuarterCode)) continue;

    const quarterType = requireRecord(typeByName.get(planned.plan.quarterType), planned.plan.quarterType);
    const area = requireRecord(areas.get(planned.plan.areaName), planned.plan.areaName);
    const ranks = planned.plan.quarterType === "C" ? officerTypeResidentRanks : generalResidentRanks;
    const residentRank = ranks[residentSequence % ranks.length];
    const designation = requireRecord(designationByCode.get(residentRank), `${residentRank} designation`);
    const posting = units[residentSequence % units.length]!;
    residentSequence += planned.occupied ? 1 : 0;

    await prisma.$transaction(async (tx) => {
      const quarter = await tx.quarter.create({
        data: {
          areaId: area.id,
          quarterTypeId: quarterType.id,
          wing: planned.plan.name,
          block: planned.block,
          floor: String(planned.floor),
          houseNumber: planned.fullQuarterCode,
          fullQuarterCode: planned.fullQuarterCode,
          status: QuarterStatus.AVAILABLE,
          conditionRemarks: `Dummy inventory: ${planned.plan.name}`,
          isActive: true,
          createdById: actor.id,
          approvedByAdmin: true,
          adminApprovedById: actor.id,
          adminApprovedAt: new Date()
        }
      });

      if (!planned.occupied) return;
      const serial = String(occupiedCreated + 1).padStart(4, "0");
      const person = await tx.personnel.create({
        data: {
          indexNumber: `DUMMY-${planned.fullQuarterCode}`,
          buckleNumber: `DUMMY-B-${serial}`,
          fullName: `Dummy Resident ${planned.fullQuarterCode}`,
          mobileNumber: String(9000000000 + occupiedCreated + 1),
          designationId: designation.id,
          currentPoliceUnitId: posting.id,
          currentAddress: `${planned.fullQuarterCode}, ${planned.plan.areaName}`,
          serviceJoinDate: new Date(Date.UTC(2010 + (occupiedCreated % 12), occupiedCreated % 12, 1 + (occupiedCreated % 25))),
          createdById: actor.id
        }
      });
      await tx.occupancyRecord.create({
        data: {
          personnelId: person.id,
          quarterId: quarter.id,
          allocatedDate: new Date(Date.UTC(2020 + (occupiedCreated % 5), occupiedCreated % 12, 1 + (occupiedCreated % 25))),
          possessionDate: new Date(Date.UTC(2020 + (occupiedCreated % 5), occupiedCreated % 12, 1 + (occupiedCreated % 25))),
          allocationReferenceNo: `DUMMY/OCC/${serial}`,
          remarks: "Seeded occupied test quarter",
          createdById: actor.id
        }
      });
      await tx.quarter.update({ where: { id: quarter.id }, data: { status: QuarterStatus.OCCUPIED } });
      await tx.quarterStatusHistory.create({
        data: {
          quarterId: quarter.id,
          oldStatus: QuarterStatus.AVAILABLE,
          newStatus: QuarterStatus.OCCUPIED,
          reason: "Dummy occupied inventory seed",
          changedById: actor.id
        }
      });
    });

    created += 1;
    if (planned.occupied) occupiedCreated += 1;
  }

  const totals = plans.map((plan) => {
    const quarters = buildQuarterPlan(plan);
    return {
      property: plan.name,
      area: plan.areaName,
      type: plan.quarterType,
      total: quarters.length,
      occupied: quarters.filter((quarter) => quarter.occupied).length,
      available: quarters.filter((quarter) => !quarter.occupied).length
    };
  });
  console.table(totals);
  console.log(`Dummy inventory target: ${generated.length} quarters, ${generated.filter((quarter) => quarter.occupied).length} occupied.`);
  console.log(`This run created: ${created} quarters, ${occupiedCreated} occupied resident records; existing seeded codes skipped: ${generated.length - created}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
