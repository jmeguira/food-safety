import { describe, expect, it } from "vitest";
import { fetchAnnouncements, normalizeAnnouncement } from "../../src/ingest/announcements.js";
import { fixtureFetch } from "../../src/ingest/fixtures.js";
import type { Recall } from "../../src/shared/recall.js";

const BASE = "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/";
const TAYLOR = `${BASE}taylor-farms-issues-recall-h-e-b-backyard-bbq-chop-salad-kit-due-potential-undeclared-soy-and-tree`;
const HAIFA = `${BASE}haifa-smoked-fish-recalls-cold-smoked-sprats-due-potential-health-risk`;
const GROCERS = `${BASE}natural-grocers-recalls-natural-grocers-brand-organic-2-pound-mung-beans-due-potential-presence`;
const PAR = `${BASE}par-health-issues-voluntary-nationwide-recall-argatroban-injection-due-presence-particulate-matter`;
const NOVA = `${BASE}nova-biomedicalr-announces-global-medical-device-correction-statstripr-glucose-hospital-meter`;
const WEDGEWOOD = `${BASE}wedgewood-pharmacy-issues-recall-certain-compounded-veterinary-medications-within-expiry-due`;
const PAN_PEPIN = `${BASE}pan-pepin-inc-emite-alerta-por-alergenos-en-el-producto-parabien-al-grano-debido-la-presencia-de`;
// Its page is not recorded, so fda.gov answers 404.
const TONIGHT = `${BASE}tonight-we-ride-llc-issues-voluntary-recall-ultimate-forza-male-supplement-due-presence-undeclared`;

const sleeps: number[] = [];
const run = async (previous: Recall[] = [], fetchFn: typeof fetch = fixtureFetch) => {
  const raw = await fetchAnnouncements(fetchFn, previous, { sleep: async (ms) => void sleeps.push(ms) });
  return raw.map(normalizeAnnouncement);
};
const byUrl = (recalls: Recall[], url: string) => recalls.find((r) => r.links[0].url === url)!;

describe("announcements", () => {
  it("become unclassified active recalls linking their announcement", async () => {
    const recalls = await run();
    expect(recalls).toHaveLength(8);
    for (const r of recalls) {
      expect(r).toMatchObject({ source: "fda-announcement", classification: null, status: "active" });
      expect(r.id).toBe(`fda-announcement:${new URL(r.links[0].url).pathname}`);
      expect(r.links[0].url).toMatch(/^https:\/\/www\.fda\.gov\/safety\/recalls-market-withdrawals-safety-alerts\//);
    }
    expect(byUrl(recalls, HAIFA)).toMatchObject({
      reportedAt: "2026-10-27",
      initiatedAt: "2026-10-27",
      firm: "D&M Smoked Fish Inc. dba Haifa Smoked Fish Inc.",
      product: "Cold Smoked Sprat Fish",
    });
  });

  it("page text yields its states, and the product type its category", async () => {
    const recalls = await run();
    expect(byUrl(recalls, TAYLOR)).toMatchObject({ category: "food", states: ["TX"], nationwide: false, locationUnclear: false });
    expect(byUrl(recalls, HAIFA).states).toEqual(["NJ", "NY", "PA"]);
    expect(byUrl(recalls, GROCERS).states).toEqual(expect.arrayContaining(["AR", "WY", "TX"]));
    expect(byUrl(recalls, GROCERS).states).toHaveLength(22);
    expect(byUrl(recalls, PAR)).toMatchObject({ category: "drug" });
    expect(byUrl(recalls, NOVA)).toMatchObject({ category: "device", foreign: true });
    expect(byUrl(recalls, WEDGEWOOD)).toMatchObject({ nationwide: true });
    expect(byUrl(recalls, PAN_PEPIN).states).toEqual(["PR"]);
  });

  it("failure of a page keeps the item with what the feed gave", async () => {
    const recalls = await run();
    expect(byUrl(recalls, TONIGHT)).toMatchObject({
      locationUnclear: true,
      states: [],
      product: expect.stringContaining("Ultimate Forza Male Supplement"),
      reportedAt: "2026-10-24",
    });

    const throwing = (async (url) => {
      if (String(url).endsWith("rss.xml")) return fixtureFetch(url);
      throw new Error("socket hang up");
    }) as typeof fetch;
    const all = await run([], throwing);
    expect(all).toHaveLength(8);
    expect(all.every((r) => r.locationUnclear)).toBe(true);

    const garbled = (async (url) =>
      String(url).endsWith("rss.xml") ? fixtureFetch(url) : new Response("<html>maintenance</html>")) as typeof fetch;
    expect((await run([], garbled)).every((r) => r.locationUnclear)).toBe(true);
  });

  it("failure of the feed fails the source", async () => {
    await expect(run([], (async () => new Response("", { status: 503 })) as typeof fetch)).rejects.toThrow("503");
  });

  it("cache: a refresh fetches only pages it has not read before", async () => {
    const first = await run();
    const urls: string[] = [];
    const spy = (async (url, init) => {
      urls.push(String(url));
      return fixtureFetch(url, init);
    }) as typeof fetch;

    // The recall whose page failed is read again; the others are not.
    const again = await run(first, spy);
    expect(urls.filter((u) => !u.endsWith("rss.xml"))).toEqual([TONIGHT]);
    expect(again).toHaveLength(8);
    expect(byUrl(again, HAIFA)).toEqual(byUrl(first, HAIFA));
  });

  it("cache: a page read without a distribution is not read again", async () => {
    const first = await run();
    const bare = first.map((r) => (r.firm === "" ? r : { ...r, distributionText: "", states: [] }));
    const urls: string[] = [];
    const spy = (async (url, init) => {
      urls.push(String(url));
      return fixtureFetch(url, init);
    }) as typeof fetch;
    await run(bare, spy);
    expect(urls.filter((u) => !u.endsWith("rss.xml"))).toEqual([TONIGHT]);
  });

  it("asks fda.gov for one page a second", async () => {
    sleeps.length = 0;
    await run();
    // Eight pages follow the feed; each request waits for the one before.
    expect(sleeps).toEqual(Array(8).fill(1000));
  });
});
