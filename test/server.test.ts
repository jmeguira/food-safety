import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";

const dir = mkdtempSync(path.join(tmpdir(), "web-"));
writeFileSync(path.join(dir, "index.html"), "<div id=root>shell</div>");
const app = createApp(dir);

describe("server", () => {
  it("answers the health check", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it.each(["/", "/dashboard", "/some/client/route"])("serves the shell at %s", async (p) => {
    const res = await app.request(p);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("shell");
  });

  it("does not serve the shell for unknown API paths", async () => {
    expect((await app.request("/api/nope")).status).toBe(404);
  });
});
