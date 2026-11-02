import type { ClassCounts, StateSummary } from "../../../shared/api";
import type { SeverityClass } from "../../../shared/severity";

/** Most severe first. */
export const CLASS_ORDER: readonly SeverityClass[] = ["I", "II", "III", "unclassified"];

export type WindowChoice = "90" | "365" | "all";

export const WINDOWS: readonly { value: WindowChoice; label: string }[] = [
  { value: "90", label: "last 90 days" },
  { value: "365", label: "last 12 months" },
  { value: "all", label: "all ongoing" },
];

export const DEFAULT_WINDOW: WindowChoice = "365";

/** The `since` date of a window in the viewer's clock; undefined for all ongoing, which sends none. */
export function sinceFor(choice: WindowChoice, today: Date = new Date()): string | undefined {
  if (choice === "all") return undefined;
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (choice === "90") d.setUTCDate(d.getUTCDate() - 90);
  else d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export interface Shown {
  counts: ClassCounts;
  mostSevere: SeverityClass | null;
}

const none = (): ClassCounts => ({ I: 0, II: 0, III: 0, unclassified: 0 });

/** What a state shows: its own counts, plus the nationwide ones when asked, narrowed to one class when given. */
export function shownFor(
  state: StateSummary | undefined,
  nationwide: StateSummary | undefined,
  includeNationwide: boolean,
  cls: SeverityClass | "all",
): Shown {
  const counts = none();
  for (const c of CLASS_ORDER) {
    if (cls !== "all" && cls !== c) continue;
    counts[c] = (state?.active[c] ?? 0) + (includeNationwide ? (nationwide?.active[c] ?? 0) : 0);
  }
  return { counts, mostSevere: CLASS_ORDER.find((c) => counts[c] > 0) ?? null };
}
