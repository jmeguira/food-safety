import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hazardOf } from "../../src/ingest/hazard.js";
import { HAZARDS, type Hazard, type RecallCategory } from "../../src/shared/recall.js";

/** Reasons recorded from openFDA enforcement reports, each with its recall's id. */
const cases: { id: string; category: RecallCategory; reason: string; hazard: Hazard }[] = JSON.parse(
  readFileSync(new URL("../fixtures/hazards.json", import.meta.url), "utf8"),
);

describe("hazardOf", () => {
  it("covers every hazard in the recorded cases", () => {
    expect(new Set(cases.map((c) => c.hazard))).toEqual(new Set(HAZARDS));
  });

  it.each(cases)("$id is $hazard", ({ reason, category, hazard }) => {
    expect(hazardOf(reason, category)).toBe(hazard);
  });

  it("takes the first hazard in the list when a reason names several", () => {
    expect(hazardOf("Listeria monocytogenes; the label also omits the lot code", "food")).toBe("listeria");
    expect(hazardOf("May contain STEC E. coli and/or Salmonella", "food")).toBe("salmonella");
    expect(hazardOf("Undeclared milk and glass fragments", "food")).toBe("allergen");
  });

  it("is other when the reason names no hazard", () => {
    expect(hazardOf("", "food")).toBe("other");
    expect(hazardOf("Product was shipped late", "drug")).toBe("other");
  });

  it("does not read the verb 'lead' as the metal", () => {
    expect(hazardOf("Spoilage could lead to illness", "food")).toBe("other");
    expect(hazardOf("Elevated lead in the product", "food")).toBe("chemical");
  });

  it("names a device defect only for a device", () => {
    expect(hazardOf("Software error in the pump", "device")).toBe("device-defect");
    expect(hazardOf("Software error in the pump", "drug")).toBe("other");
    expect(hazardOf("Mislabeled and may malfunction", "device")).toBe("device-defect");
  });
});
