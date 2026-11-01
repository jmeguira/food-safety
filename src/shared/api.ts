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

/** Query parameters of `GET /api/stats/timeseries`. Dates are YYYY-MM-DD and bound the date a recall began. */
export interface TimeseriesQuery {
  interval: "month" | "year";
  category?: RecallCategory;
  class?: SeverityClass;
  state?: string;
  from?: string;
  to?: string;
}

export interface TimeseriesPeriod {
  /** `YYYY-MM` or `YYYY`. */
  period: string;
  counts: ClassCounts;
  total: number;
}

export interface TimeseriesResponse {
  interval: "month" | "year";
  /** Every period from the first to the last, zeros included. */
  periods: TimeseriesPeriod[];
  /** Each source's earliest date in the snapshot, whatever the filters. */
  earliest: Record<string, string>;
}

/** Recalls per state over a date range by class, plus a `nationwide` key for those that list every state. */
export type StatsStatesResponse = Record<string, ClassCounts>;

export interface SummaryResponse {
  active: ClassCounts;
  /** Recalls that began this week (from Monday), this month and this year. */
  began: { week: number; month: number; year: number };
  /** Null when no recall has both a start and a classification date. */
  medianDaysToClassification: number | null;
}
