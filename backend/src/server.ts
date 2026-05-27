import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

const app = createApp();

async function attachFrontend() {
  if (config.NODE_ENV === "development") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: config.frontendRoot,
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) return next();
      try {
        const template = readFileSync(resolve(config.frontendRoot, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
    return;
  }
  const dist = resolve(config.frontendRoot, "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
  }
}

await attachFrontend();
const server = app.listen(config.PORT, () => {
  console.log(`PQAMS available at http://localhost:${config.PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
