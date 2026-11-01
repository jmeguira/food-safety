import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Health } from "../shared/api.js";
import type { Snapshot } from "../ingest/snapshot.js";
import { apiRoutes } from "./api.js";

export function createApp(
  webRoot: string,
  current: () => Snapshot | null = () => null,
  now: () => Date = () => new Date(),
): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json<Health>({ ok: true }));
  app.route("/api", apiRoutes(current, now));
  app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

  // serveStatic resolves its root against the working directory.
  app.use("*", serveStatic({ root: path.relative(process.cwd(), webRoot) || "." }));

  // A missing file must not answer with the page: a stale script URL would load HTML as a 200.
  app.get("*", async (c, next) => {
    const p = c.req.path;
    if (p.startsWith("/assets/") || path.posix.extname(p)) return c.notFound();
    return next();
  });

  // Any other path gets the shell so client routes load directly.
  app.get("*", async (c) => c.html(await readFile(path.join(webRoot, "index.html"), "utf8")));

  return app;
}
