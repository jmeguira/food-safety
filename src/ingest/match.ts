import type { RawRecall } from "../shared/recall.js";

/** An announcement and a report of one recall are initiated within this many days of each other. */
export const MATCH_WINDOW_DAYS = 14;

const ENDINGS = new Set(["inc", "incorporated", "llc", "co", "corp", "corporation", "ltd", "company"]);
const DAY_MS = 86_400_000;

/** A firm's words: lower case, punctuation dropped, company endings removed. */
export function firmWords(firm: string): string[] {
  return firm
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !ENDINGS.has(w));
}

/** Names agree when one's words are all among the other's. */
export function firmsAgree(a: string, b: string): boolean {
  const x = firmWords(a);
  const y = firmWords(b);
  if (!x.length || !y.length) return false;
  const [small, large] = x.length <= y.length ? [x, y] : [y, x];
  return small.every((w) => large.includes(w));
}

const days = (iso: string) => Date.parse(iso) / DAY_MS;

export function matches(announcement: RawRecall, report: RawRecall): boolean {
  if (announcement.category !== report.category) return false;
  if (!announcement.initiatedAt || !report.initiatedAt) return false;
  if (Math.abs(days(report.initiatedAt) - days(announcement.initiatedAt)) > MATCH_WINDOW_DAYS) return false;
  return firmsAgree(announcement.firm, report.firm);
}

/**
 * Each announcement that matches an enforcement report leaves the list, and the report gains its link.
 * An announcement takes the closest report in time; a report takes one announcement at most.
 */
export function mergeAnnouncements<T extends RawRecall>(recalls: T[]): T[] {
  const reports = recalls.filter((r) => r.source !== "fda-announcement");
  const gained = new Map<T, T>();
  const matched = new Set<T>();
  const gap = (a: T, r: T) => Math.abs(days(r.initiatedAt!) - days(a.initiatedAt!));
  for (const a of recalls) {
    if (a.source !== "fda-announcement") continue;
    const best = reports
      .filter((r) => !gained.has(r) && matches(a, r))
      .sort((p, q) => gap(a, p) - gap(a, q))[0];
    if (!best) continue;
    matched.add(a);
    gained.set(best, { ...best, links: [...best.links, ...a.links.filter((l) => !best.links.some((k) => k.url === l.url))] });
  }
  return recalls.filter((r) => !matched.has(r)).map((r) => gained.get(r) ?? r);
}
