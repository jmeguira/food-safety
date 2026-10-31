import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { recall, snapshot } from "./helpers";

const states = async (recalls: ReturnType<typeof recall>[]) =>
  (await createApp("/nonexistent", () => snapshot(recalls)).request("/api/states")).json() as Promise<
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
