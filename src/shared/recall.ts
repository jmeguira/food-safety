export type RecallSource = "openfda-food" | "openfda-drug" | "openfda-device" | "fsis" | "fda-announcement";
export type RecallCategory = "food" | "drug" | "device" | "meat-poultry-egg";

export const HAZARDS = [
  "listeria",
  "salmonella",
  "e-coli",
  "other-pathogen",
  "allergen",
  "foreign-material",
  "chemical",
  "sterility",
  "potency",
  "cgmp",
  "device-defect",
  "labeling",
  "other",
] as const;
/** The cause a recall's reason names; `other` when it names none of the rest. */
export type Hazard = (typeof HAZARDS)[number];

export interface RecallLink {
  label: string;
  url: string;
}

/** One recall from any source; every source normalizes to this and nothing downstream reads a source's own fields. */
export interface Recall {
  /** Source and recall number. */
  id: string;
  source: RecallSource;
  category: RecallCategory;
  recallNumber: string;
  /** Null until the agency has classified the recall. */
  classification: "I" | "II" | "III" | null;
  status: "active" | "closed";
  product: string;
  reason: string;
  hazard: Hazard;
  firm: string;
  firmCity: string | null;
  firmState: string | null;
  distributionText: string;
  /** USPS codes. */
  states: string[];
  nationwide: boolean;
  foreign: boolean;
  locationUnclear: boolean;
  quantity: string | null;
  codeInfo: string | null;
  /** Null when the source does not say who initiated it. */
  voluntary: boolean | null;
  /** ISO dates (YYYY-MM-DD), null when absent. */
  initiatedAt: string | null;
  reportedAt: string | null;
  classifiedAt: string | null;
  closedAt: string | null;
  links: RecallLink[];
}

/** A Recall as a source normalizes it, before the snapshot assigns its hazard. */
export type RawRecall = Omit<Recall, "hazard">;
