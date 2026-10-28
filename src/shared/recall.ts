export type RecallSource = "openfda-food" | "openfda-drug" | "openfda-device" | "fsis" | "fda-announcement";
export type RecallCategory = "food" | "drug" | "device" | "meat-poultry-egg";

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
