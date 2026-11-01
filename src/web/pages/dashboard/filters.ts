import { useSearchParams } from "react-router-dom";
import type { RecallCategory } from "../../../shared/recall";
import type { SeverityClass } from "../../../shared/severity";

export const CATEGORIES: { value: RecallCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "meat-poultry-egg", label: "Meat, poultry and egg" },
  { value: "drug", label: "Drug" },
  { value: "device", label: "Device" },
];
export const CLASSES: SeverityClass[] = ["I", "II", "III", "unclassified"];

export interface Filters {
  category?: RecallCategory;
  class?: SeverityClass;
  from?: string;
  to?: string;
  interval: "month" | "year";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The filters live in the URL, so a link to a view opens it; a value that is not valid is ignored. */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [params, setParams] = useSearchParams();
  const category = params.get("category");
  const cls = params.get("class");
  const from = params.get("from");
  const to = params.get("to");
  const filters: Filters = {
    category: CATEGORIES.find((c) => c.value === category)?.value,
    class: CLASSES.find((c) => c === cls),
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    interval: params.get("interval") === "month" ? "month" : "year",
  };
  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) out.set(k, v);
    setParams(out);
  };
  return [filters, update];
}

export const query = (params: Record<string, string | undefined>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};
