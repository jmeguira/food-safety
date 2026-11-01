import { Hono } from "hono";
import type { MetaResponse, RecallsResponse, StateSummary, StatesResponse } from "../shared/api.js";
import type { SeverityClass } from "../shared/severity.js";
import { STATES } from "../shared/states.js";
import type { Snapshot } from "../ingest/snapshot.js";
import { statesOverRange, summary, timeseries } from "./stats.js";

const CLASSES: SeverityClass[] = ["I", "II", "III", "unclassified"];

const emptySummary = (): StateSummary => ({
  active: { I: 0, II: 0, III: 0, unclassified: 0 },
  mostSevere: null,
});

const add = (summary: StateSummary, cls: SeverityClass) => {
  summary.active[cls]++;
  summary.mostSevere ??= cls;
  if (CLASSES.indexOf(cls) < CLASSES.indexOf(summary.mostSevere)) summary.mostSevere = cls;
};

/** A nationwide recall lists every state, so it is counted under `nationwide` and in no state's own counts. */
export function summarizeStates(snapshot: Snapshot): StatesResponse {
  const out: StatesResponse = { nationwide: emptySummary() };
  for (const s of STATES) out[s.code] = emptySummary();
  for (const r of snapshot.recalls) {
    if (r.status !== "active") continue;
    const cls = r.classification ?? "unclassified";
    if (r.nationwide) add(out.nationwide, cls);
    else for (const code of r.states) if (out[code]) add(out[code], cls);
  }
  return out;
}

const summaries = new WeakMap<Snapshot, StatesResponse>();

/** A snapshot is replaced whole on refresh, so its summary is computed once per snapshot. */
const statesOf = (snapshot: Snapshot): StatesResponse => {
  let out = summaries.get(snapshot);
  if (!out) summaries.set(snapshot, (out = summarizeStates(snapshot)));
  return out;
};

const MAX_CACHED = 200;
const cached = new WeakMap<Snapshot, Map<string, unknown>>();

/** Aggregates are kept per snapshot, so a refresh drops them with it. */
const memo = <T>(snapshot: Snapshot, key: string, compute: () => T): T => {
  let m = cached.get(snapshot);
  if (!m) cached.set(snapshot, (m = new Map()));
  if (!m.has(key)) {
    if (m.size >= MAX_CACHED) m.clear();
    m.set(key, compute());
  }
  return m.get(key) as T;
};

const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Routes read the snapshot per request, so a swap is seen by the next one. */
export function apiRoutes(
  current: () => Snapshot | null,
  now: () => Date = () => new Date(),
): Hono {
  const api = new Hono();
  const empty: Snapshot = { generatedAt: "", sources: {}, recalls: [] };
  const snapshot = (): Snapshot => current() ?? empty;

  api.get("/recalls", (c) => {
    const { status, category, class: cls, state } = c.req.query();
    const recalls = snapshot().recalls.filter(
      (r) =>
        (!status || r.status === status) &&
        (!category || r.category === category) &&
        (!cls || (r.classification ?? "unclassified") === cls) &&
        (!state || r.states.includes(state.toUpperCase())),
    );
    return c.json<RecallsResponse>(recalls);
  });

  api.get("/recalls/:id", (c) => {
    const recall = snapshot().recalls.find((r) => r.id === c.req.param("id"));
    return recall ? c.json(recall) : c.json({ error: "not found" }, 404);
  });

  api.get("/states", (c) => c.json<StatesResponse>(statesOf(snapshot())));

  const today = () => now().toISOString().slice(0, 10);
  const badDate = (q: Record<string, string | undefined>) =>
    ["from", "to"].find((k) => q[k] && !validDate(q[k]!));

  api.get("/stats/timeseries", (c) => {
    const q = c.req.query();
    if (q.interval !== "month" && q.interval !== "year")
      return c.json({ error: "interval must be month or year" }, 400);
    const bad = badDate(q);
    if (bad) return c.json({ error: `${bad} must be YYYY-MM-DD` }, 400);
    const { interval, category, class: cls, state, from, to } = q;
    const day = today();
    const key = JSON.stringify(["ts", interval, category, cls, state, from, to, day]);
    return c.json(
      memo(snapshot(), key, () =>
        timeseries(snapshot(), { interval, category, class: cls, state, from, to }, day),
      ),
    );
  });

  api.get("/stats/states", (c) => {
    const { from, to } = c.req.query();
    const bad = badDate({ from, to });
    if (bad) return c.json({ error: `${bad} must be YYYY-MM-DD` }, 400);
    return c.json(
      memo(snapshot(), JSON.stringify(["st", from, to]), () =>
        statesOverRange(snapshot(), from, to),
      ),
    );
  });

  api.get("/stats/summary", (c) => {
    const day = today();
    return c.json(memo(snapshot(), `sum${day}`, () => summary(snapshot(), day)));
  });

  api.get("/meta", (c) => c.json<MetaResponse>(snapshot().sources));

  return api;
}
