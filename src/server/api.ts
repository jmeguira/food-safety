import { Hono } from "hono";
import type { MetaResponse, RecallsResponse, StateSummary, StatesResponse } from "../shared/api.js";
import type { SeverityClass } from "../shared/severity.js";
import { STATES } from "../shared/states.js";
import type { Snapshot } from "../ingest/snapshot.js";

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

/** Routes read the snapshot per request, so a swap is seen by the next one. */
export function apiRoutes(current: () => Snapshot | null): Hono {
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

  api.get("/meta", (c) => c.json<MetaResponse>(snapshot().sources));

  return api;
}
