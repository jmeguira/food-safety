import { useState, type ReactNode } from "react";
import type { Loaded } from "./useApi";

/** A chart with a table of the same numbers behind a toggle. */
export function Panel<T>({
  title,
  result,
  chart,
  table,
}: {
  title: string;
  result: Loaded<T>;
  chart: (data: T) => ReactNode;
  table: (data: T) => ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {result === null ? (
        <p>Loading…</p>
      ) : "error" in result ? (
        <p role="alert">Could not load: {result.error}</p>
      ) : (
        <>
          <div role="group" aria-label={`${title} view`}>
            <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
              Chart
            </button>{" "}
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
              Table
            </button>
          </div>
          {view === "chart" ? chart(result.data) : table(result.data)}
        </>
      )}
    </section>
  );
}
