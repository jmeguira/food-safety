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
  /** `YYYY-MM-DD`; keeps recalls begun on or after it. A recall begins on `initiatedAt`, else `reportedAt`; one with neither is left out. */
  since?: string;
}

/** Query parameters of `GET /api/states`; each one given narrows what is counted. */
export interface StatesQuery {
  category?: RecallCategory;
  /** `YYYY-MM-DD`; counts recalls begun on or after it, as in `RecallsQuery`. */
  since?: string;
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
