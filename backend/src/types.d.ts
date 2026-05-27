import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        id: string;
        username: string;
        fullName: string;
        role: UserRole;
        policeUnitId: string | null;
        mustChangePassword: boolean;
      };
    }
  }
}

export {};

