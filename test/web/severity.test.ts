import { describe, expect, it } from "vitest";
import { severity } from "../../src/web/severity";

describe("severity", () => {
  it.each(["I", "II", "III", "unclassified"] as const)("describes %s", (k) => {
    const s = severity[k];
    expect(s.label).not.toBe("");
    expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(s.meaning).not.toBe("");
  });

  it("gives each class its own color", () => {
    const colors = Object.values(severity).map((s) => s.color);
    expect(new Set(colors).size).toBe(4);
  });
});
