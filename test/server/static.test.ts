import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";

const dir = mkdtempSync(path.join(tmpdir(), "web-"));
writeFileSync(path.join(dir, "index.html"), "<div id=root>shell</div>");
mkdirSync(path.join(dir, "assets"));
writeFileSync(path.join(dir, "assets", "app.js"), "console.log(1)");
const app = createApp(dir);

describe("static files", () => {
  it.each(["/assets/missing.js", "/assets/nothing", "/missing.css", "/favicon.ico"])(
    "answers 404 for %s",
    async (p) => {
      expect((await app.request(p)).status).toBe(404);
    },
  );

  it.each(["/", "/dashboard", "/map/ca"])(
    "still serves the page at the client route %s",
    async (p) => {
      const res = await app.request(p);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("shell");
    },
  );

  it("serves a file that exists", async () => {
    const res = await app.request("/assets/app.js");
    expect(res.status).toBe(200);
  });
});
