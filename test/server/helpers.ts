import type { Snapshot } from "../../src/ingest/snapshot.js";
import type { Recall } from "../../src/shared/recall.js";

export const recall = (over: Partial<Recall>): Recall => ({
  id: "openfda-food:F-1",
  source: "openfda-food",
  category: "food",
  recallNumber: "F-1",
  classification: "II",
  status: "active",
  product: "p",
  reason: "r",
  hazard: "other",
  firm: "f",
  firmCity: null,
  firmState: null,
  distributionText: "",
  states: [],
  nationwide: false,
  foreign: false,
  locationUnclear: false,
  quantity: null,
  codeInfo: null,
  voluntary: null,
  initiatedAt: null,
  reportedAt: null,
  classifiedAt: null,
  closedAt: null,
  links: [],
  ...over,
});

export const snapshot = (recalls: Recall[], sources: Snapshot["sources"] = {}): Snapshot => ({
  generatedAt: "2026-01-01T00:00:00.000Z",
  sources,
  recalls,
});
