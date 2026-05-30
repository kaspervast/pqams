import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import quarterRoutes from "./routes/quarters.js";
import personnelRoutes from "./routes/personnel.js";
import applicationRoutes from "./routes/applications.js";
import operationsRoutes from "./routes/operations.js";
import { errorHandler, ok } from "./lib/http.js";

export function createApp() {
  const app = express();
  app.set("etag", false);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.vary("Authorization");
    next();
  });
  app.get("/api/health", (_req, res) => ok(res, { status: "ok" }, "PQAMS API is running"));
  app.use("/api/auth", authRoutes);
  app.use("/api", adminRoutes);
  app.use("/api", quarterRoutes);
  app.use("/api", personnelRoutes);
  app.use("/api", applicationRoutes);
  app.use("/api", operationsRoutes);
  app.use(errorHandler);
  return app;
}
