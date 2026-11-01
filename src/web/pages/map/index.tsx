import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { MetaResponse, StatesQuery, StatesResponse } from "../../../shared/api";
import type { Recall, RecallCategory } from "../../../shared/recall";
import type { SeverityClass } from "../../../shared/severity";
import { STATES, TERRITORY_CODES } from "../../../shared/states";
import { severity } from "../../severity";
import { HEIGHT, WIDTH, shapes } from "./geometry";
import { LISTS, RecallDetail, RecallList, getJson } from "./details";
import { CLASS_ORDER, DEFAULT_WINDOW, WINDOWS, shownFor, sinceFor, type Shown, type WindowChoice } from "./model";

const CATEGORIES: { value: RecallCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "drug", label: "Drugs" },
  { value: "device", label: "Devices" },
  { value: "meat-poultry-egg", label: "Meat, poultry and eggs" },
];

const UNSHADED = "#e5e7eb";
const stateName = new Map(STATES.map((s) => [s.code, s.name]));

const total = (s: Shown) => CLASS_ORDER.reduce((n, c) => n + s.counts[c], 0);

const describe = (name: string, s: Shown) =>
  total(s) === 0
    ? `${name}: no active recalls`
    : `${name}: ${CLASS_ORDER.filter((c) => s.counts[c] > 0)
        .map((c) => `${severity[c].label} ${s.counts[c]}`)
        .join(", ")}`;

function ClassList({ shown }: { shown: Shown }) {
  return (
    <ul>
      {CLASS_ORDER.map((c) => (
        <li key={c}>
          {severity[c].label}: {shown.counts[c]}
        </li>
      ))}
    </ul>
  );
}

export default function MapPage() {
  const [window, setWindow] = useState<WindowChoice>(DEFAULT_WINDOW);
  const [category, setCategory] = useState<RecallCategory | "all">("all");
  const [cls, setCls] = useState<SeverityClass | "all">("all");
  const [includeNationwide, setIncludeNationwide] = useState(false);
  /** The response with the window it answers, so the label never runs ahead of the data. */
  const [loaded, setLoaded] = useState<{ window: WindowChoice; states: StatesResponse } | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaFailed, setMetaFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const selected = params.get("state");
  const listKind = LISTS.find((l) => l.value === params.get("list"))?.value ?? null;
  const recallId = params.get("recall");
  const [listed, setListed] = useState<{ key: string; recalls: Recall[] } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoaded(null);
    setError(null);
    const query: StatesQuery & Record<string, string | undefined> = {
      since: sinceFor(window),
      category: category === "all" ? undefined : category,
    };
    const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1])).toString();
    getJson<StatesResponse>(`/api/states${qs ? `?${qs}` : ""}`).then(
      (s) => current && setLoaded({ window, states: s }),
      (e: Error) => current && setError(e.message),
    );
    return () => {
      current = false;
    };
  }, [window, category]);

  useEffect(() => {
    getJson<MetaResponse>("/api/meta").then(setMeta, () => setMetaFailed(true));
  }, []);

  const choose = (next: Record<string, string>) => setParams(next);
  const selectState = (code: string) => choose({ state: code });
  const listQuery = (() => {
    if (!selected && !listKind) return null;
    const q = new URLSearchParams({ status: "active" });
    const since = sinceFor(window);
    if (since) q.set("since", since);
    if (category !== "all") q.set("category", category);
    if (selected) q.set("state", selected);
    return `/api/recalls?${q}`;
  })();
  useEffect(() => {
    if (!listQuery) return;
    let current = true;
    setListError(null);
    getJson<Recall[]>(listQuery).then(
      (r) => current && setListed({ key: listQuery, recalls: r }),
      (e: Error) => current && setListError(e.message),
    );
    return () => {
      current = false;
    };
  }, [listQuery]);
  const listRecalls = listed && listed.key === listQuery ? listed.recalls : null;
  const visible = listRecalls?.filter((r) =>
    selected
      ? (includeNationwide || !r.nationwide) && (cls === "all" || (r.classification ?? "unclassified") === cls)
      : LISTS.find((l) => l.value === listKind)!.keeps(r),
  );
  const listTitle = selected ? (stateName.get(selected) ?? selected) : (LISTS.find((l) => l.value === listKind)?.label ?? "");

  const states = loaded?.states ?? null;
  const shown = (code: string) => shownFor(states?.[code], states?.nationwide, includeNationwide, cls);
  const nationwide = shownFor(states?.nationwide, undefined, false, cls);
  const active = hovered ?? focused;
  const windowLabel = loaded && WINDOWS.find((w) => w.value === loaded.window)!.label;

  return (
    <main>
      <h1>Map</h1>
      {windowLabel && (
        <p>
          Active recalls that began within: <strong>{windowLabel}</strong>
        </p>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Began within{" "}
          <select value={window} onChange={(e) => setWindow(e.target.value as WindowChoice)}>
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          Category{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value as RecallCategory | "all")}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          Class{" "}
          <select value={cls} onChange={(e) => setCls(e.target.value as SeverityClass | "all")}>
            <option value="all">All classes</option>
            {CLASS_ORDER.map((c) => (
              <option key={c} value={c}>
                {severity[c].label}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={includeNationwide}
            onChange={(e) => setIncludeNationwide(e.target.checked)}
          />{" "}
          Add nationwide recalls to every state
        </label>
      </form>

      {recallId && (
        <RecallDetail
          id={recallId}
          meta={meta}
          onClose={() => choose(selected ? { state: selected } : listKind ? { list: listKind } : {})}
        />
      )}

      {error && <p role="alert">Could not load recalls: {error}</p>}
      {!states && !error && <p>Loading…</p>}

      {states && (
        <>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Map of US states shaded by most severe active recall">
            {shapes.map(({ code, name, d }) => {
              const s = shown(code);
              return (
                <path
                  key={code}
                  d={d}
                  data-state={code}
                  data-severity={s.mostSevere ?? "none"}
                  fill={s.mostSevere ? severity[s.mostSevere].color : UNSHADED}
                  stroke="#fff"
                  strokeWidth={1}
                  tabIndex={0}
                  role="button"
                  aria-label={describe(name, s)}
                  onClick={() => selectState(code)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectState(code)}
                  onMouseEnter={() => setHovered(code)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setFocused(code)}
                  onBlur={() => setFocused(null)}
                />
              );
            })}
          </svg>

          <div role="tooltip" aria-live="polite">
            {active ? (
              <>
                <strong>{stateName.get(active)}</strong>
                <ClassList shown={shown(active)} />
              </>
            ) : (
              <span>Hover or focus a state to see its active recalls by class.</span>
            )}
          </div>

          <section aria-label="Territories">
            <h2>Territories</h2>
            <ul>
              {STATES.filter((s) => TERRITORY_CODES.has(s.code)).map((s) => (
                <li key={s.code}>{describe(s.name, shown(s.code))}</li>
              ))}
            </ul>
          </section>

          <section aria-label="Nationwide recalls">
            <h2>Nationwide recalls</h2>
            <p>Active, in every state.</p>
            <ClassList shown={nationwide} />
          </section>

          <section aria-label="Other lists">
            <h2>Other lists</h2>
            <ul>
              {LISTS.map((l) => (
                <li key={l.value}>
                  <button type="button" onClick={() => choose({ list: l.value })}>
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {(selected || listKind) && windowLabel && (
            <>
              {listError && <p role="alert">Could not load recalls: {listError}</p>}
              {!visible && !listError && <p>Loading…</p>}
              {visible && !recallId && (
                <RecallList
                  title={listTitle}
                  windowLabel={windowLabel}
                  recalls={visible}
                  onOpen={(id) => choose({ ...(selected ? { state: selected } : { list: listKind! }), recall: id })}
                />
              )}
            </>
          )}
        </>
      )}

      <section aria-label="Legend">
        <h2>Legend</h2>
        <ul>
          {CLASS_ORDER.map((c) => (
            <li key={c}>
              <svg width={14} height={14} aria-hidden="true">
                <rect width={14} height={14} fill={severity[c].color} />
              </svg>{" "}
              <strong>{severity[c].label}</strong>: {severity[c].meaning}
            </li>
          ))}
          <li>
            <svg width={14} height={14} aria-hidden="true">
              <rect width={14} height={14} fill={UNSHADED} />
            </svg>{" "}
            <strong>No active recall</strong>
          </li>
        </ul>
        <p>A state is shaded by its most severe active recall.</p>
      </section>

      {metaFailed && <p role="alert">Freshness unavailable.</p>}
      {meta && (
        <section aria-label="Data freshness">
          <h2>Data freshness</h2>
          <ul>
            {Object.entries(meta).map(([id, m]) => (
              <li key={id}>
                {id}: {m.refreshedAt ? `refreshed ${m.refreshedAt}` : "never refreshed"}
                {m.error && <strong role="alert"> Refresh failed: {m.error}</strong>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
