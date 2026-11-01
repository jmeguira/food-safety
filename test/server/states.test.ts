import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { recall, snapshot } from "./helpers";

const states = async (recalls: ReturnType<typeof recall>[], qs = "") =>
  (await createApp("/nonexistent", () => snapshot(recalls)).request(`/api/states${qs}`)).json() as Promise<
    Record<string, { active: Record<string, number>; mostSevere: string | null }>
  >;

describe("GET /api/states", () => {
  it("counts active state-named recalls by class and picks the most severe", async () => {
    const s = await states([
      recall({ classification: "III", states: ["CA"] }),
      recall({ classification: "II", states: ["CA", "NV"] }),
      recall({ classification: null, states: ["CA"] }),
      recall({ classification: "I", status: "closed", states: ["CA"] }),
    ]);
    expect(s.CA).toEqual({ active: { I: 0, II: 1, III: 1, unclassified: 1 }, mostSevere: "II" });
    expect(s.NV.mostSevere).toBe("II");
    expect(s.TX).toEqual({ active: { I: 0, II: 0, III: 0, unclassified: 0 }, mostSevere: null });
  });

  it("counts nationwide recalls apart from every state", async () => {
    const all = ["CA", "TX"];
    const s = await states([recall({ classification: "I", nationwide: true, states: all })]);
    expect(s.nationwide).toEqual({ active: { I: 1, II: 0, III: 0, unclassified: 0 }, mostSevere: "I" });
    expect(s.CA.mostSevere).toBeNull();
    expect(s.TX.active.I).toBe(0);
  });

  it("has an entry for every state", async () => {
    expect(Object.keys(await states([])).length).toBeGreaterThanOrEqual(51);
  });
});

describe("GET /api/states since and category", () => {
  const recalls = [
    recall({ classification: "I", states: ["CA"], initiatedAt: "2020-01-01" }),
    recall({ classification: "III", states: ["CA"], reportedAt: "2026-03-01" }),
    recall({ classification: "II", category: "drug", states: ["CA"], initiatedAt: "2026-02-01" }),
    recall({ classification: "I", states: ["CA"] }),
    recall({ classification: "I", nationwide: true, states: ["CA"], initiatedAt: "2020-01-01" }),
  ];

  it("counts all active recalls, dated or not, without parameters", async () => {
    const s = await states(recalls);
    expect(s.CA.active).toEqual({ I: 2, II: 1, III: 1, unclassified: 0 });
    expect(s.nationwide.active.I).toBe(1);
  });

  it("counts only recalls begun on or after since", async () => {
    const s = await states(recalls, "?since=2026-01-01");
    expect(s.CA).toEqual({ active: { I: 0, II: 1, III: 1, unclassified: 0 }, mostSevere: "II" });
    expect(s.nationwide.mostSevere).toBeNull();
  });

  it("counts only the category", async () => {
    const s = await states(recalls, "?category=drug");
    expect(s.CA.active).toEqual({ I: 0, II: 1, III: 0, unclassified: 0 });
  });

  it("combines since and category", async () => {
    const s = await states(recalls, "?category=food&since=2026-01-01");
    expect(s.CA.active).toEqual({ I: 0, II: 0, III: 1, unclassified: 0 });
  });

  it("rejects a malformed date", async () => {
    const res = await createApp("/nonexistent", () => snapshot([])).request("/api/states?since=x");
    expect(res.status).toBe(400);
  });
});
