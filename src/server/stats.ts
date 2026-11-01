import type {
  ClassCounts,
  StatsStatesResponse,
  SummaryResponse,
  TimeseriesResponse,
} from "../shared/api.js";
import type { Recall } from "../shared/recall.js";
import type { SeverityClass } from "../shared/severity.js";
import type { Snapshot } from "../ingest/snapshot.js";

const DAY_MS = 86_400_000;

export const emptyCounts = (): ClassCounts => ({
  I: 0,
  II: 0,
  III: 0,
  unclassified: 0,
});

export const classOf = (r: Recall): SeverityClass => r.classification ?? "unclassified";

/** The date a recall began; the report date when the source gives no start. Null when it has neither. */
export const countedAt = (r: Recall): string | null => r.initiatedAt ?? r.reportedAt;

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export interface TimeseriesFilter {
  interval: "month" | "year";
  category?: string;
  class?: string;
  state?: string;
  from?: string;
  to?: string;
}

const periodOf = (date: string, interval: "month" | "year") =>
  date.slice(0, interval === "year" ? 4 : 7);

function* periods(first: string, last: string, interval: "month" | "year"): Generator<string> {
  let y = Number(first.slice(0, 4));
  let m = interval === "year" ? 1 : Number(first.slice(5, 7));
  const end = periodOf(last, interval);
  for (;;) {
    const p = interval === "year" ? String(y) : `${y}-${String(m).padStart(2, "0")}`;
    if (p > end) return;
    yield p;
    if (interval === "year") y++;
    else if (++m > 12) ((m = 1), y++);
  }
}

/** Each source's earliest counted date over the whole snapshot, whatever the filters. */
export function earliestBySource(snapshot: Snapshot): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of snapshot.recalls) {
    const d = countedAt(r);
    if (d && (!out[r.source] || d < out[r.source])) out[r.source] = d;
  }
  return out;
}

export function timeseries(
  snapshot: Snapshot,
  f: TimeseriesFilter,
  today: string,
): TimeseriesResponse {
  const rows = new Map<string, ClassCounts>();
  let min: string | null = null;
  let snapMin: string | null = null;
  let snapMax: string | null = null;
  for (const r of snapshot.recalls) {
    const d = countedAt(r);
    if (!d) continue;
    if (!snapMin || d < snapMin) snapMin = d;
    if (!snapMax || d > snapMax) snapMax = d;
    if (f.category && r.category !== f.category) continue;
    if (f.class && classOf(r) !== f.class) continue;
    if (f.state && !r.states.includes(f.state.toUpperCase())) continue;
    if ((f.from && d < f.from) || (f.to && d > f.to)) continue;
    const p = periodOf(d, f.interval);
    let row = rows.get(p);
    if (!row) rows.set(p, (row = emptyCounts()));
    row[classOf(r)]++;
    if (!min || d < min) min = d;
  }
  // Requested dates are clamped to the snapshot's span so the output never grows with the request.
  const spanEnd = snapMax && snapMax > today ? snapMax : today;
  const first = f.from ? (snapMin && f.from < snapMin ? snapMin : f.from) : min;
  const last = f.to && f.to < spanEnd ? f.to : spanEnd;
  const out: TimeseriesResponse = {
    interval: f.interval,
    periods: [],
    earliest: earliestBySource(snapshot),
  };
  if (!snapMin || !first || first > last) return out;
  for (const period of periods(first, last, f.interval)) {
    const counts = rows.get(period) ?? emptyCounts();
    out.periods.push({
      period,
      counts,
      total: counts.I + counts.II + counts.III + counts.unclassified,
    });
  }
  return out;
}

/** Nationwide recalls list every state, so they are counted under `nationwide` and in no state's own counts. */
export function statesOverRange(
  snapshot: Snapshot,
  from?: string,
  to?: string,
): StatsStatesResponse {
  const out: StatsStatesResponse = { nationwide: emptyCounts() };
  for (const r of snapshot.recalls) {
    const d = countedAt(r);
    if (!d || (from && d < from) || (to && d > to)) continue;
    const cls = classOf(r);
    if (r.nationwide) out.nationwide[cls]++;
    else for (const code of r.states) (out[code] ??= emptyCounts())[cls]++;
  }
  return out;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Weeks start on Monday (UTC). */
export function summary(snapshot: Snapshot, today: string): SummaryResponse {
  const day = dayNumber(today);
  const weekStart = isoDay((day - ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)) * DAY_MS);
  const out: SummaryResponse = {
    active: emptyCounts(),
    began: { week: 0, month: 0, year: 0 },
    medianDaysToClassification: null,
  };
  const lags: number[] = [];
  for (const r of snapshot.recalls) {
    if (r.status === "active") out.active[classOf(r)]++;
    const d = countedAt(r);
    if (!d) continue;
    if (d <= today) {
      if (d >= weekStart) out.began.week++;
      if (d.slice(0, 7) === today.slice(0, 7)) out.began.month++;
      if (d.slice(0, 4) === today.slice(0, 4)) out.began.year++;
    }
    if (r.classifiedAt) {
      const lag = dayNumber(r.classifiedAt) - dayNumber(d);
      if (lag >= 0) lags.push(lag);
    }
  }
  out.medianDaysToClassification = median(lags);
  return out;
}
