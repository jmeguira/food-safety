import { writeFile } from "node:fs/promises";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeReport } from "../../src/ingest/openfda.js";
import { hazardOf } from "../../src/ingest/hazard.js";
import { buildSnapshot, readSnapshot, writeSnapshot } from "../../src/ingest/snapshot.js";
import type { Source } from "../../src/ingest/sources.js";

const food = JSON.parse(readFileSync(new URL("../fixtures/openfda/food.json", import.meta.url), "utf8")).results;
const make = (id: "openfda-food" | "openfda-drug", fetch: Source["fetch"]): Source => ({
  id,
  fetch,
  normalize: (raw) => ({ ...normalizeReport("food", raw as never), source: id }),
});
const noFetch = (async () => new Response()) as typeof fetch;

describe("buildSnapshot", () => {
  it("keeps a failed source's previous records and records its error", async () => {
    const ok = [make("openfda-food", async () => food), make("openfda-drug", async () => food.slice(0, 2))];
    const first = await buildSnapshot(ok, null, noFetch, new Date("2026-01-01T00:00:00Z"));
    expect(first.recalls).toHaveLength(5);

    const broken = [make("openfda-food", async () => food.slice(0, 1)), make("openfda-drug", async () => { throw new Error("boom"); })];
    const second = await buildSnapshot(broken, first, noFetch, new Date("2026-01-02T00:00:00Z"));

    expect(second.recalls.filter((r) => r.source === "openfda-drug")).toHaveLength(2);
    expect(second.recalls.filter((r) => r.source === "openfda-food")).toHaveLength(1);
    expect(second.sources["openfda-food"]).toEqual({ refreshedAt: "2026-01-02T00:00:00.000Z", count: 1, error: null });
    expect(second.sources["openfda-drug"]).toEqual({ refreshedAt: "2026-01-01T00:00:00.000Z", count: 2, error: "boom" });
  });

  it("has no records and a null refresh for a source that has never succeeded", async () => {
    const s = await buildSnapshot([make("openfda-food", async () => { throw new Error("down"); })], null, noFetch);
    expect(s.recalls).toEqual([]);
    expect(s.sources["openfda-food"]).toMatchObject({ refreshedAt: null, count: 0, error: "down" });
  });
});

describe("snapshot file", () => {
  it("is written whole and read back", async () => {
    const dir = mkdtempSync(join(tmpdir(), "snap-"));
    const path = join(dir, "data", "snapshot.json");
    expect(await readSnapshot(path)).toBeNull();
    const snap = await buildSnapshot([make("openfda-food", async () => food)], null, noFetch);
    await writeSnapshot(path, snap);
    expect(await readSnapshot(path)).toEqual(snap);
    expect(readdirSync(join(dir, "data"))).toEqual(["snapshot.json"]);
  });
});

describe("snapshot file without hazards", () => {
  it("gets each recall's hazard when read", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "snap-")), "s.json");
    const recall = { id: "x", category: "food", reason: "Listeria monocytogenes contamination" };
    await writeFile(path, JSON.stringify({ generatedAt: "2026-01-01T00:00:00Z", sources: {}, recalls: [recall] }));
    expect((await readSnapshot(path))!.recalls[0].hazard).toBe("listeria");
  });
});

describe("hazard", () => {
  it("is set on every source's recalls from their reason", async () => {
    const s = await buildSnapshot(
      [make("openfda-food", async () => food), make("openfda-drug", async () => food.slice(0, 1))],
      null,
      noFetch,
    );
    expect(s.recalls).toHaveLength(4);
    expect(s.recalls.every((r) => r.hazard === hazardOf(r.reason, r.category))).toBe(true);
    expect(s.recalls.map((r) => r.hazard)).not.toContain(undefined);
  });
});
