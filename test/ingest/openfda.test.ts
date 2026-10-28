import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchEndpoint, normalizeReport, type Endpoint, type OpenFdaReport } from "../../src/ingest/openfda.js";

const load = (e: Endpoint) =>
  (JSON.parse(readFileSync(new URL(`../fixtures/openfda/${e}.json`, import.meta.url), "utf8")) as { results: OpenFdaReport[] })
    .results;

describe("normalize", () => {
  it("maps a food report", () => {
    expect(normalizeReport("food", load("food")[0])).toEqual({
      id: "openfda-food:F-0848-2024",
      source: "openfda-food",
      category: "food",
      recallNumber: "F-0848-2024",
      classification: "II",
      status: "closed",
      product: "GRANDE     1.5OZ FRESH BOCCONCINI MOZZ 1/3#         SUPC/ITEM # 19132P",
      reason: expect.stringContaining("not held at an appropriate temperature"),
      firm: "Greco Sidari",
      firmCity: "Cleveland",
      firmState: "OH",
      distributionText: "OH, NY & PA",
      states: ["NY", "OH", "PA"],
      nationwide: false,
      foreign: false,
      locationUnclear: false,
      quantity: "1375 cases total",
      codeInfo: "All Lot Codes Distributed between November 26, 2023 and January 5, 2024",
      voluntary: true,
      initiatedAt: "2024-01-11",
      reportedAt: "2024-02-14",
      classifiedAt: "2024-02-05",
      closedAt: "2024-09-05",
      links: [
        { label: "openFDA record", url: 'https://api.fda.gov/food/enforcement.json?search=recall_number:"F-0848-2024"' },
      ],
    });
  });

  it("maps a drug report", () => {
    const r = normalizeReport("drug", load("drug")[0]);
    expect(r).toMatchObject({
      id: "openfda-drug:D-0179-2024",
      source: "openfda-drug",
      category: "drug",
      classification: "II",
      status: "closed",
      firm: "CARDINAL HEALTHCARE",
      nationwide: true,
      initiatedAt: "2022-01-26",
      classifiedAt: "2023-12-26",
      closedAt: "2024-09-29",
    });
    expect(r.states).toHaveLength(51);
    expect(r.links[0].url).toContain("/drug/enforcement.json");
  });

  it("maps a device report, leaving absent fields null", () => {
    const r = normalizeReport("device", load("device")[0]);
    expect(r).toMatchObject({
      id: "openfda-device:Z-0691-2024",
      category: "device",
      status: "active",
      firmCity: "Nishishirakawa-Gun",
      firmState: null,
      nationwide: true,
      closedAt: null,
      quantity: "2210 US; 6002 OUS",
    });
  });

  it("leaves the class null until classified and reads other statuses", () => {
    const base = load("food")[0];
    expect(normalizeReport("food", { ...base, classification: "" }).classification).toBeNull();
    expect(normalizeReport("food", { ...base, classification: "Class III" }).classification).toBe("III");
    for (const [status, expected] of [["Ongoing", "active"], ["Pending", "active"], ["Completed", "closed"]] as const) {
      expect(normalizeReport("food", { ...base, status }).status).toBe(expected);
    }
  });
});

describe("paging", () => {
  // A stub of openFDA that refuses skip above 25,000 and holds 30,000 reports on 2013 days.
  const days = 365;
  const reports: OpenFdaReport[] = Array.from({ length: 30000 }, (_, i) => {
    const d = new Date(Date.UTC(2013, 0, 1 + (i % days)));
    return { recall_number: `F-${i}`, report_date: d.toISOString().slice(0, 10).replaceAll("-", "") };
  });
  reports.push({ recall_number: "F-old", report_date: "20120301" });

  const stub = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const [, from, to] = /\[(\d+) TO (\d+)\]/.exec(url.searchParams.get("search")!)!;
    const skip = Number(url.searchParams.get("skip"));
    const limit = Number(url.searchParams.get("limit"));
    if (skip > 25000 || limit > 1000) return new Response("{}", { status: 400 });
    const hits = reports.filter((r) => r.report_date! >= from && r.report_date! <= to);
    if (hits.length === 0) return new Response("{}", { status: 404 });
    return Response.json({ meta: { results: { skip, limit, total: hits.length } }, results: hits.slice(skip, skip + limit) });
  }) as typeof fetch;

  it("reads every report of an endpoint past the skip limit", async () => {
    const got = await fetchEndpoint("food", stub, new Date(Date.UTC(2013, 5, 1)));
    expect(got).toHaveLength(reports.length);
    expect(new Set(got.map((r) => r.recall_number)).size).toBe(reports.length);
  });

  it("fails when a request fails", async () => {
    const failing = (async () => new Response("", { status: 500 })) as typeof fetch;
    await expect(fetchEndpoint("food", failing, new Date(Date.UTC(2012, 5, 1)))).rejects.toThrow("500");
  });
});
