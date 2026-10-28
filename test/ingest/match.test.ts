import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { firmsAgree, matches, mergeAnnouncements } from "../../src/ingest/match.js";
import { buildSnapshot } from "../../src/ingest/snapshot.js";
import type { Recall } from "../../src/shared/recall.js";

interface Case {
  announcementUrl: string;
  announcementFirm: string;
  announcedAt: string;
  category: Recall["category"];
  recallNumber: string;
  reportFirm: string;
  initiatedAt: string;
}
const cases: { pairs: Case[]; misses: Case[] } = JSON.parse(
  readFileSync(new URL("../fixtures/match.json", import.meta.url), "utf8"),
);

const recall = (over: Partial<Recall>): Recall => ({
  id: "",
  source: "openfda-food",
  category: "food",
  recallNumber: "",
  classification: null,
  status: "active",
  product: "",
  reason: "",
  firm: "",
  firmCity: null,
  firmState: null,
  distributionText: "",
  states: [],
  nationwide: false,
  foreign: false,
  locationUnclear: false,
  quantity: null,
  codeInfo: null,
  voluntary: null,
  initiatedAt: null,
  reportedAt: null,
  classifiedAt: null,
  closedAt: null,
  links: [],
  ...over,
});
const announcement = (c: Case) =>
  recall({
    id: `fda-announcement:${c.announcementUrl}`,
    source: "fda-announcement",
    category: c.category,
    firm: c.announcementFirm,
    initiatedAt: c.announcedAt,
    links: [{ label: "FDA announcement", url: c.announcementUrl }],
  });
const report = (c: Case) =>
  recall({
    id: `openfda-${c.category}:${c.recallNumber}`,
    source: `openfda-${c.category}` as Recall["source"],
    category: c.category,
    recallNumber: c.recallNumber,
    classification: "II",
    firm: c.reportFirm,
    initiatedAt: c.initiatedAt,
    links: [{ label: "openFDA", url: "https://api.fda.gov" }],
  });

describe("matching", () => {
  it.each(cases.pairs.map((c) => [c.recallNumber, c] as const))("matches %s", (_, c) => {
    expect(matches(announcement(c), report(c))).toBe(true);
  });

  it.each(cases.misses.map((c) => [c.recallNumber, c] as const))("does not match near miss %s", (_, c) => {
    expect(matches(announcement(c), report(c))).toBe(false);
  });

  it("never matches records of different categories", () => {
    const c = cases.pairs[0];
    expect(matches(announcement({ ...c, category: "drug" }), report(c))).toBe(false);
  });

  it("holds the window at 14 days either side", () => {
    const base = { ...cases.pairs[0], announcedAt: "2026-03-15" };
    const at = (initiatedAt: string) => matches(announcement(base), report({ ...base, initiatedAt }));
    expect([at("2026-03-01"), at("2026-03-29"), at("2026-02-28"), at("2026-03-30")]).toEqual([true, true, false, false]);
  });

  it("does not match a record with no date", () => {
    const c = cases.pairs[0];
    expect(matches({ ...announcement(c), initiatedAt: null }, report(c))).toBe(false);
  });

  it("normalizes endings, punctuation and case, and lets one name's words contain the other's", () => {
    expect(firmsAgree("Slade Gorton & Co., Inc.", "SLADE GORTON & CO., INC.")).toBe(true);
    expect(firmsAgree("Publix", "Publix Super Markets, Inc.")).toBe(true);
    expect(firmsAgree("Big Y Foods", "Big Y Supermarkets")).toBe(false);
    expect(firmsAgree("Inc.", "LLC")).toBe(false);
  });
});

describe("merge", () => {
  it("makes the report carry the announcement's link and drops the announcement", () => {
    const [c, other] = cases.pairs;
    const merged = mergeAnnouncements([announcement(c), report(c), report(other)]);
    expect(merged).toEqual([
      { ...report(c), links: [...report(c).links, ...announcement(c).links] },
      report(other),
    ]);
  });

  it("leaves an unmatched announcement as it is", () => {
    const [c] = cases.misses;
    const recalls = [announcement(c), report(c)];
    expect(mergeAnnouncements(recalls)).toEqual(recalls);
  });

  it("gives each announcement the closest report and each report at most one announcement", () => {
    const c = { ...cases.pairs[0], announcedAt: "2026-03-15" };
    const near = report({ ...c, recallNumber: "near", initiatedAt: "2026-03-14" });
    const far = report({ ...c, recallNumber: "far", initiatedAt: "2026-03-05" });
    const a1 = announcement(c);
    const a2 = announcement({ ...c, announcementUrl: "https://www.fda.gov/second" });
    const merged = mergeAnnouncements([a1, a2, far, near]);
    expect(merged.map((r) => [r.recallNumber, r.links.length])).toEqual([["far", 2], ["near", 2]]);
  });

  it("happens in the snapshot once every source is fetched", async () => {
    const c = cases.pairs[0];
    const source = (id: Recall["source"], r: Recall) => ({
      id,
      fetch: async () => [r],
      normalize: (raw: unknown) => raw as Recall,
    });
    const snap = await buildSnapshot(
      [source("openfda-food", report(c)), source("fda-announcement", announcement(c))],
      null,
      (async () => new Response()) as typeof fetch,
    );
    expect(snap.recalls).toHaveLength(1);
    expect(snap.recalls[0].links.map((l) => l.url)).toContain(c.announcementUrl);
  });
});
