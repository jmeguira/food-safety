import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ClassCounts,
  MetaResponse,
  StatsHazardsResponse,
  StatsStatesResponse,
  SummaryResponse,
  TimeseriesResponse,
} from "../../../shared/api";
import type { Hazard, Recall } from "../../../shared/recall";
import { STATES } from "../../../shared/states";
import { severity } from "../../severity";
import { CATEGORIES, CLASSES, query, useFilters, type Filters } from "./filters";
import { hazardLabel } from "./hazards";
import { Panel } from "./Panel";
import { useApi, type Loaded } from "./useApi";

const TOP = 10;
const stateName = (code: string) =>
  code === "nationwide" ? "Nationwide" : (STATES.find((s) => s.code === code)?.name ?? code);

/** The class filter keeps one class of a row's counts. */
const shown = (c: ClassCounts, cls: Filters["class"]) => (cls ? c[cls] : CLASSES.reduce((n, k) => n + c[k], 0));
const visible = (cls: Filters["class"]) => (cls ? [cls] : CLASSES);

function Summary() {
  const summary = useApi<SummaryResponse>("/api/stats/summary");
  const meta = useApi<MetaResponse>("/api/meta");
  if (!summary || !meta) return <p>Loading…</p>;
  if ("error" in summary || "error" in meta) return <p role="alert">Could not load the figures.</p>;
  const { active, began, medianDaysToClassification } = summary.data;
  return (
    <section aria-label="Summary">
      <h2>Now</h2>
      <ul>
        {CLASSES.map((k) => (
          <li key={k}>
            <span style={{ color: severity[k].color }} aria-hidden>
              ■
            </span>{" "}
            Active {severity[k].label}: <strong>{active[k]}</strong>
          </li>
        ))}
        <li>
          Begun this month: <strong>{began.month}</strong>
        </li>
        <li>
          Median days to classification:{" "}
          <strong>{medianDaysToClassification ?? "none yet"}</strong>
        </li>
      </ul>
      <h3>Freshness</h3>
      <ul>
        {Object.entries(meta.data).map(([name, s]) => (
          <li key={name}>
            {name}: {s.refreshedAt ? `refreshed ${s.refreshedAt}` : "never refreshed"}
            {s.error ? ` (error: ${s.error})` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimeChart({ filters }: { filters: Filters }) {
  const { interval, category, class: cls, from, to } = filters;
  const result = useApi<TimeseriesResponse>(
    `/api/stats/timeseries${query({ interval, category, class: cls, from, to })}`,
  );
  return (
    <Panel
      title="Recalls over time"
      result={result}
      chart={(d) => (
        <>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.periods.map((p) => ({ period: p.period, ...p.counts }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend formatter={(k: string) => severity[k as keyof typeof severity].label} />
                {visible(cls).map((k) => (
                  <Bar key={k} dataKey={k} stackId="classes" fill={severity[k].color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Earliest earliest={d.earliest} />
        </>
      )}
      table={(d) => (
        <>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                {visible(cls).map((k) => (
                  <th key={k}>{severity[k].label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {d.periods.map((p) => (
                <tr key={p.period}>
                  <th scope="row">{p.period}</th>
                  {visible(cls).map((k) => (
                    <td key={k}>{p.counts[k]}</td>
                  ))}
                  <td>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Earliest earliest={d.earliest} />
        </>
      )}
    />
  );
}

/** Sources' histories differ in length; a jump where one begins is not a rise in recalls. */
function Earliest({ earliest }: { earliest: Record<string, string> }) {
  const entries = Object.entries(earliest);
  if (!entries.length) return null;
  return (
    <p>
      History starts: {entries.map(([source, date]) => `${source} ${date}`).join(", ")}. A jump
      where a source begins is its history arriving, not more recalls.
    </p>
  );
}

interface Row {
  name: string;
  byClass: ClassCounts;
}

function RankChart({
  title,
  label,
  rows,
}: {
  title: string;
  label: string;
  rows: Loaded<Row[]>;
}) {
  return (
    <Panel
      title={title}
      result={rows}
      chart={(r) => (
        <div style={{ height: 40 + r.length * 28 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.map((x) => ({ name: x.name, ...x.byClass }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={150} />
              <Tooltip />
              {CLASSES.map((k) => (
                <Bar key={k} dataKey={k} stackId="classes" fill={severity[k].color} name={severity[k].label} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      table={(r) => (
        <table>
          <thead>
            <tr>
              <th>{label}</th>
              {CLASSES.map((k) => (
                <th key={k}>{severity[k].label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {r.map((x) => (
              <tr key={x.name}>
                <th scope="row">{x.name}</th>
                {CLASSES.map((k) => (
                  <td key={k}>{x.byClass[k]}</td>
                ))}
                <td>{CLASSES.reduce((n, k) => n + x.byClass[k], 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

/** Narrows class counts to the class filter by zeroing the others. */
const only = (c: ClassCounts, cls: Filters["class"]): ClassCounts =>
  Object.fromEntries(CLASSES.map((k) => [k, !cls || cls === k ? c[k] : 0])) as ClassCounts;

function loading<T, R>(r: Loaded<T>, ok: (d: T) => R): Loaded<R> {
  return r === null || "error" in r ? r : { data: ok(r.data) };
}

function Hazards({ filters }: { filters: Filters }) {
  const { category, class: cls, from, to } = filters;
  const result = useApi<StatsHazardsResponse>(`/api/stats/hazards${query({ category, from, to })}`);
  const rows = loading(result, (d) =>
    (Object.entries(d) as [Hazard, ClassCounts][])
      .map(([h, c]) => ({ name: hazardLabel[h], byClass: only(c, cls) }))
      .filter((r) => shown(r.byClass, cls) > 0)
      .sort((a, b) => shown(b.byClass, cls) - shown(a.byClass, cls))
      .slice(0, TOP),
  );
  return <RankChart title="Leading hazards" label="Hazard" rows={rows} />;
}

/** Recalls that began in the range, as the stats endpoint counts them. */
const began = (r: Recall) => r.initiatedAt ?? r.reportedAt;

/**
 * The states endpoint takes no category, so with one chosen the recalls themselves are
 * counted the same way: nationwide ones apart, in no state's own counts.
 */
function useStateCounts({ category, from, to }: Filters): Loaded<StatsStatesResponse> {
  const stats = useApi<StatsStatesResponse>(
    category ? null : `/api/stats/states${query({ from, to })}`,
  );
  const recalls = useApi<Recall[]>(category ? `/api/recalls${query({ category })}` : null);
  const list = recalls && "data" in recalls ? recalls.data : null;
  const tally = useMemo(() => (list ? tallyStates(list, from, to) : null), [list, from, to]);
  if (!category) return stats;
  if (tally) return { data: tally };
  return recalls && "error" in recalls ? recalls : null;
}

function tallyStates(list: Recall[], from?: string, to?: string): StatsStatesResponse {
  const out: StatsStatesResponse = {};
  for (const r of list) {
    const d = began(r);
    if (!d || (from && d < from) || (to && d > to)) continue;
    const cls = r.classification ?? "unclassified";
    for (const key of r.nationwide ? ["nationwide"] : r.states) {
      out[key] ??= { I: 0, II: 0, III: 0, unclassified: 0 };
      out[key][cls]++;
    }
  }
  return out;
}

function States({ filters }: { filters: Filters }) {
  const result = useStateCounts(filters);
  const rows = loading(result, (d) =>
    Object.entries(d)
      .map(([code, c]) => ({ name: stateName(code), byClass: only(c, filters.class) }))
      .filter((r) => shown(r.byClass, filters.class) > 0)
      .sort((a, b) => shown(b.byClass, filters.class) - shown(a.byClass, filters.class))
      .slice(0, TOP),
  );
  return <RankChart title="States with the most recalls" label="State" rows={rows} />;
}

export default function Dashboard() {
  const [filters, update] = useFilters();
  return (
    <main>
      <h1>Dashboard</h1>
      <Summary />
      <form aria-label="Filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Category{" "}
          <select
            value={filters.category ?? ""}
            onChange={(e) => update({ category: (e.target.value || undefined) as Filters["category"] })}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          Class{" "}
          <select
            value={filters.class ?? ""}
            onChange={(e) => update({ class: (e.target.value || undefined) as Filters["class"] })}
          >
            <option value="">All</option>
            {CLASSES.map((k) => (
              <option key={k} value={k}>
                {severity[k].label}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          From{" "}
          <input type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>{" "}
        <label>
          To{" "}
          <input type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>{" "}
        <label>
          Group by{" "}
          <select
            value={filters.interval}
            onChange={(e) => update({ interval: e.target.value as Filters["interval"] })}
          >
            <option value="year">Year</option>
            <option value="month">Month</option>
          </select>
        </label>
      </form>
      <TimeChart filters={filters} />
      <Hazards filters={filters} />
      <States filters={filters} />
    </main>
  );
}
