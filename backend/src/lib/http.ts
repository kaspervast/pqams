import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Array<{ field?: string; message: string }>
  ) {
    super(message);
  }
}

export function pathParam(req: Request, name = "id") {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new ApiError(400, `Invalid ${name} path parameter`);
  return value;
}

export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

function jsonSafe(data: unknown) {
  return JSON.parse(JSON.stringify(data, (_key, value) => typeof value === "bigint" ? Number(value) : value));
}

export const ok = (res: Response, data: unknown, message = "Request successful", status = 200) =>
  res.status(status).json({ success: true, message, data: jsonSafe(data) });

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ success: false, message: error.message, errors: error.errors ?? [] });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(409).json({ success: false, message: "A matching record already exists", errors: [] });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal server error", errors: [] });
}
