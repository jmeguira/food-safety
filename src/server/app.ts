import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Health } from "../shared/health.js";

export function createApp(webRoot: string): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json<Health>({ ok: true }));
  app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

  // serveStatic resolves its root against the working directory.
  app.use("*", serveStatic({ root: path.relative(process.cwd(), webRoot) || "." }));

  // Any other path gets the shell so client routes load directly.
  app.get("*", async (c) => c.html(await readFile(path.join(webRoot, "index.html"), "utf8")));

  return app;
}
