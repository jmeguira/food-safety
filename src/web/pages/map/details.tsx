import { useEffect, useState } from "react";
import type { MetaResponse } from "../../../shared/api";
import type { Recall } from "../../../shared/recall";
import { severity } from "../../severity";
import { CLASS_ORDER } from "./model";

export const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json() as Promise<T>;
};

export type ListKind = "nationwide" | "unclear" | "unclassified";

export const LISTS: readonly { value: ListKind; label: string; keeps: (r: Recall) => boolean }[] = [
  { value: "nationwide", label: "Nationwide", keeps: (r) => r.nationwide },
  { value: "unclear", label: "Location unclear", keeps: (r) => r.locationUnclear },
  { value: "unclassified", label: "Announced, not yet classified", keeps: (r) => r.classification === null },
];

const classOf = (r: Recall) => r.classification ?? "unclassified";
const began = (r: Recall) => r.initiatedAt ?? r.reportedAt ?? "";

/** Most severe class first, then newest first; ties by id so the order is stable. */
export function sortRecalls(recalls: Recall[]): Recall[] {
  return [...recalls].sort(
    (a, b) =>
      CLASS_ORDER.indexOf(classOf(a)) - CLASS_ORDER.indexOf(classOf(b)) ||
      began(b).localeCompare(began(a)) ||
      a.id.localeCompare(b.id),
  );
}

export function RecallList({
  title,
  windowLabel,
  recalls,
  onOpen,
}: {
  title: string;
  windowLabel: string;
  recalls: Recall[];
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-label="Recalls">
      <h2>{title}</h2>
      <p>
        Active recalls that began within: <strong>{windowLabel}</strong>
      </p>
      {recalls.length === 0 ? (
        <p>No active recalls.</p>
      ) : (
        <ol>
          {sortRecalls(recalls).map((r) => (
            <li key={r.id}>
              <strong>{severity[classOf(r)].label}</strong>{" "}
              <button type="button" onClick={() => onOpen(r.id)}>
                {r.product}
              </button>{" "}
              — {r.firm}
              {r.initiatedAt ?? r.reportedAt ? `, ${r.initiatedAt ?? r.reportedAt}` : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const DATES: [keyof Recall, string][] = [
  ["initiatedAt", "Initiated"],
  ["reportedAt", "Reported"],
  ["classifiedAt", "Classified"],
  ["closedAt", "Closed"],
];

export function RecallDetail({ id, meta, onClose }: { id: string; meta: MetaResponse | null; onClose: () => void }) {
  const [recall, setRecall] = useState<Recall | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setRecall(null);
    setError(null);
    getJson<Recall>(`/api/recalls/${encodeURIComponent(id)}`).then(
      (r) => current && setRecall(r),
      (e: Error) => current && setError(e.message),
    );
    return () => {
      current = false;
    };
  }, [id]);

  if (error) return <p role="alert">Could not load the recall: {error}</p>;
  if (!recall) return <p>Loading…</p>;

  const cls = classOf(recall);
  const rows: [string, string | null][] = [
    ["Product", recall.product],
    ["Reason", recall.reason],
    ["Firm", recall.firm],
    ["City", recall.firmCity],
    ["State", recall.firmState],
    ["Class", `${severity[cls].label}: ${severity[cls].meaning}`],
    ["Status", recall.status],
    ...DATES.map(([k, label]): [string, string | null] => [label, recall[k] as string | null]),
    ["Quantity", recall.quantity],
    ["Code info", recall.codeInfo],
    ["Distribution", recall.distributionText],
  ];
  const refreshedAt = meta?.[recall.source]?.refreshedAt;

  return (
    <article aria-label="Recall detail">
      <button type="button" onClick={onClose}>
        Back to the list
      </button>
      <dl>
        {rows
          .filter(([, v]) => v)
          .map(([label, v]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        {recall.links.length > 0 && (
          <div>
            <dt>Links</dt>
            <dd>
              <ul>
                {recall.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      <p>
        Data from {recall.source}
        {refreshedAt ? `, refreshed ${refreshedAt}` : ""}. The source's notice is the authority.
      </p>
    </article>
  );
}
