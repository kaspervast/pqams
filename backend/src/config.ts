import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { basename, dirname } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3120),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default("1h"),
  REFRESH_DAYS: z.coerce.number().int().positive().default(7),
  UPLOAD_ROOT: z.string().default("./uploads"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  APP_BASE_URL: z.string().url().default("http://localhost:3120")
});

const values = envSchema.parse(process.env);
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = basename(moduleRoot) === "dist" ? resolve(moduleRoot, "..") : moduleRoot;

export const config = {
  ...values,
  backendRoot,
  uploadRoot: resolve(backendRoot, values.UPLOAD_ROOT),
  frontendRoot: resolve(backendRoot, "../frontend")
};
