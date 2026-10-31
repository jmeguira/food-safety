import type { Recall, RecallCategory } from "./recall.js";
import type { SeverityClass } from "./severity.js";

export type { Health } from "./health.js";

/** Query parameters of `GET /api/recalls`; each one given narrows the result. */
export interface RecallsQuery {
  status?: Recall["status"];
  category?: RecallCategory;
  /** `I`, `II`, `III` or `unclassified`. */
  class?: SeverityClass;
  /** USPS code; matches recalls that name the state and nationwide ones. */
  state?: string;
}

export type RecallsResponse = Recall[];

export type ClassCounts = Record<SeverityClass, number>;

export interface StateSummary {
  /** Active recalls by class. */
  active: ClassCounts;
  /** Null when there is no active recall. */
  mostSevere: SeverityClass | null;
}

/**
 * Keyed by USPS code, counting only recalls that name the state, plus a `nationwide` key
 * that counts the nationwide ones, which are in no state's own counts.
 */
export type StatesResponse = Record<string, StateSummary>;

export interface SourceMeta {
  refreshedAt: string | null;
  count: number;
  error: string | null;
}

export type MetaResponse = Record<string, SourceMeta>;
