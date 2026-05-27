import "dotenv/config";
import { PrismaClient, UnitType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const rajkotPoliceUnits = [
    "નાયબ પોલીસ કમિશ્નર ઝોન-૧",
    "મદદનિશ પોલીસ કમિશ્નર, પુર્વ વિભાગ",
    "ભક્તિનગર પોલીસ સ્ટેશન",
    "થોરાળા પોલીસ સ્ટેશન",
    "આજીડેમ પોલીસ સ્ટેશન",
    "મદદનીશ પોલીસ કમિશ્નર (ઉત્તર ડીવીઝન)",
    "બી-ડીવીઝન પોલીસ સ્ટેશન",
    "કુવાડવા રોડ પોલીસ સ્ટેશન",
    "એરપોર્ટ પોલીસ સ્ટેશન પોલીસ સ્ટેશન",
    "નાયબ પોલીસ કમિશ્‍નર ઝોન-૨ (પશ્વિમ વિભાગ)",
    "મદદનિશ પોલીસ કમિશ્નર, પશ્ચિમ વિભાગ",
    "ગાંધીગ્રામ પોલીસ સ્ટેશન",
    "પ્રદ્યુમનનગર પોલીસ સ્ટેશન",
    "ગાંધીગ્રામ-૨ (યુનિર્વસીટી) પોલીસ સ્ટેશન",
    "મદદનીશ પોલીસ કમિશ્નર (દક્ષીણ ડીવીઝન)",
    "એ ડિવીઝન પોલીસ ઇન્‍સપેકટર",
    "માલવીયાનગર પોલીસ સ્ટેશન (માલવીયાનગર)",
    "રાજકોટ તાલુકા પોલીસ સ્ટેશન",
    "નાયબ પોલીસ કમિશ્નર, (ક્રાઇમ)",
    "સ્પેશ્યલ શાખા",
    "મદદનિશ પોલીસ કમિશ્નર, ક્રાઇમ",
    "ડી.સી.બી. પોલીસ સ્ટેશન",
    "સ્પેશ્યલ ઓપરેશન ગ્રુપ",
    "મદદનીશ પોલીસ કમિશ્નર (સાયબર ક્રાઇમ)",
    "સાયબર ક્રાઇમ પોલીસ સ્ટેશન",
    "ટ્રાફિક શાખા",
    "પોલીસ હેડકવાર્ટર",
    "મદદનિશ પોલીસ કમિશ્નર, મહિલા સેલ",
    "મહિલા પોલીસ સ્ટેશન",
    "કંટ્રોલ રૂમ",
    "મદદનીશ પોલીસ કમિશ્નર (એસ.સી./એસ.ટી.સેલ)",
    "વાયરલેસ શાખા",
    "AHTU",
    "આર્થિક ગુના નિવારણ શાખા",
    "પી.સી.બી.",
    "રીડર શાખા",
    "લાયસન્સ શાખા",
    "એમ.ઓ.બી",
    "IUCAW UNIT",
    "કોમ્પ્યુટર સેલ",
    "પેરોલ ફર્લો સ્કોડ",
    "પાસપોર્ટ શાખા"
  ];
  for (const name of rajkotPoliceUnits) {
    const unitType = name.includes("હેડકવાર્ટર")
      ? UnitType.HEADQUARTER
      : name.includes("પોલીસ સ્ટેશન")
        ? UnitType.POLICE_STATION
        : UnitType.BRANCH;
    await prisma.policeUnit.upsert({
      where: { name },
      update: { unitType, isActive: true },
      create: { name, unitType }
    });
  }
  const defaultUnit = await prisma.policeUnit.findUniqueOrThrow({ where: { name: rajkotPoliceUnits[2] } });
  const headquarters = await prisma.policeUnit.findUniqueOrThrow({ where: { name: rajkotPoliceUnits[26] } });

  const designationSeeds = [
    ["LR", "Lok Rakshak", 1],
    ["PC", "Police Constable", 2],
    ["HC", "Head Constable", 3],
    ["ASI", "Assistant Sub Inspector", 4],
    ["PSI", "Police Sub Inspector", 5],
    ["PI", "Police Inspector", 6],
    ["ACP", "Assistant Commissioner of Police", 7]
  ] as const;
  for (const [code, name, rankOrder] of designationSeeds) {
    await prisma.designation.upsert({ where: { code }, update: { name, rankOrder }, create: { code, name, rankOrder } });
  }

  const quarterTypeNames = ["1 BHK", "2 BHK", "3 BHK"];
  for (const name of quarterTypeNames) {
    await prisma.quarterType.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of ["Police Headquarter", "Ramnath Para", "Mounted Police Line"]) {
    await prisma.area.upsert({ where: { name }, update: {}, create: { name } });
  }

  const designations = await prisma.designation.findMany();
  const quarterTypes = await prisma.quarterType.findMany();
  const eligibleByRank: Record<string, string[]> = {
    LR: ["1 BHK"],
    PC: ["1 BHK"],
    HC: ["1 BHK", "2 BHK"],
    ASI: ["1 BHK", "2 BHK"],
    PSI: ["1 BHK", "2 BHK"],
    PI: ["1 BHK", "2 BHK", "3 BHK"],
    ACP: ["1 BHK", "2 BHK"]
  };
  for (const designation of designations) {
    for (const quarterType of quarterTypes) {
      await prisma.eligibilityRule.upsert({
        where: { designationId_quarterTypeId: { designationId: designation.id, quarterTypeId: quarterType.id } },
        update: { isEligible: eligibleByRank[designation.code].includes(quarterType.name) },
        create: {
          designationId: designation.id,
          quarterTypeId: quarterType.id,
          isEligible: eligibleByRank[designation.code].includes(quarterType.name),
          remarks: designation.code === "ACP" && quarterType.name === "3 BHK" ? "Configurable departmental policy" : null
        }
      });
    }
  }

  const passwordHash = await bcrypt.hash("Admin@12345", 12);
  const accounts = [
    { username: "admin", fullName: "System Administrator", role: UserRole.ADMIN, policeUnitId: headquarters.id },
    { username: "superadmin", fullName: "Allotment Authority", role: UserRole.SUPER_ADMIN, policeUnitId: headquarters.id },
    { username: "correspondence", fullName: "Correspondence Branch", role: UserRole.CORRESPONDENCE_BRANCH, policeUnitId: headquarters.id },
    { username: "unituser", fullName: "Bhaktinagar Station User", role: UserRole.UNIT_USER, policeUnitId: defaultUnit.id },
    { username: "viewer", fullName: "Audit Viewer", role: UserRole.VIEWER, policeUnitId: headquarters.id }
  ];
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { username: account.username },
      update: { fullName: account.fullName, role: account.role, policeUnitId: account.policeUnitId },
      create: { ...account, passwordHash, mustChangePassword: true }
    });
  }
  await prisma.policeUnit.deleteMany({
    where: { name: { in: ["Police Headquarter", "Central Police Station"] } }
  });

  console.log("Seed complete. Bootstrap password for seeded users: Admin@12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
