import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { recall, snapshot } from "./helpers";

const NOW = new Date("2026-11-04T12:00:00Z"); // a Wednesday

const get = async (recalls: ReturnType<typeof recall>[], url: string, sources = {}) => {
  const app = createApp(
    "/nonexistent",
    () => snapshot(recalls, sources),
    () => NOW,
  );
  const res = await app.request(url);
  return { status: res.status, body: (await res.json()) as any };
};

const counts = (I = 0, II = 0, III = 0, unclassified = 0) => ({ I, II, III, unclassified });

describe("timeseries", () => {
  it("has every month from the first to the current one, zeros included", async () => {
    const { body } = await get(
      [
        recall({ initiatedAt: "2026-07-10", classification: "I" }),
        recall({ initiatedAt: "2026-07-20", classification: null }),
        recall({ initiatedAt: "2026-10-01", classification: "III" }),
      ],
      "/api/stats/timeseries?interval=month",
    );
    expect(body.periods.map((p: any) => p.period)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(body.periods[0]).toEqual({ period: "2026-07", counts: counts(1, 0, 0, 1), total: 2 });
    expect(body.periods[1].total).toBe(0);
    expect(body.periods[3].counts).toEqual(counts(0, 0, 1));
  });

  it("has a row per year up to this year", async () => {
    const { body } = await get(
      [recall({ initiatedAt: "2023-05-01" }), recall({ initiatedAt: "2025-01-01" })],
      "/api/stats/timeseries?interval=year",
    );
    expect(body.periods.map((p: any) => [p.period, p.total])).toEqual([
      ["2023", 1],
      ["2024", 0],
      ["2025", 1],
      ["2026", 0],
    ]);
  });

  it("filters by category, class, state and date range", async () => {
    const rs = [
      recall({ initiatedAt: "2026-01-05", category: "food", classification: "I", states: ["CA"] }),
      recall({ initiatedAt: "2026-02-05", category: "drug", classification: "II", states: ["CA"] }),
      recall({ initiatedAt: "2026-03-05", category: "food", classification: "I", states: ["TX"] }),
    ];
    const total = async (q: string) =>
      (await get(rs, `/api/stats/timeseries?interval=year&${q}`)).body.periods.at(-1).total;
    expect(await total("category=drug")).toBe(1);
    expect(await total("class=I")).toBe(2);
    expect(await total("state=tx")).toBe(1);
    expect(await total("from=2026-02-01&to=2026-02-28")).toBe(1);
    const { body } = await get(
      rs,
      "/api/stats/timeseries?interval=month&from=2026-02-01&to=2026-04-30",
    );
    expect(body.periods.map((p: any) => p.total)).toEqual([1, 1, 0]);
  });

  it("reports each source's earliest date whatever the filters", async () => {
    const { body } = await get(
      [
        recall({ source: "fsis", initiatedAt: "2020-02-02" }),
        recall({ source: "fsis", initiatedAt: "2021-01-01" }),
        recall({ source: "openfda-food", initiatedAt: null, reportedAt: "2012-06-01" }),
      ],
      "/api/stats/timeseries?interval=year&from=2021-01-01",
    );
    expect(body.earliest).toEqual({ fsis: "2020-02-02", "openfda-food": "2012-06-01" });
  });

  it("rejects a bad interval or date", async () => {
    expect((await get([], "/api/stats/timeseries")).status).toBe(400);
    expect((await get([], "/api/stats/timeseries?interval=week")).status).toBe(400);
    expect((await get([], "/api/stats/timeseries?interval=year&from=soon")).status).toBe(400);
  });

  it("is empty for an empty snapshot", async () => {
    expect((await get([], "/api/stats/timeseries?interval=year")).body.periods).toEqual([]);
  });
});

describe("states", () => {
  it("counts recalls per state over a range, nationwide ones apart", async () => {
    const { body } = await get(
      [
        recall({ initiatedAt: "2026-01-05", classification: "I", states: ["CA", "NV"] }),
        recall({
          initiatedAt: "2026-02-05",
          classification: "II",
          states: ["CA"],
          status: "closed",
        }),
        recall({ initiatedAt: "2025-02-05", classification: "II", states: ["CA"] }),
        recall({
          initiatedAt: "2026-02-05",
          classification: "III",
          nationwide: true,
          states: ["CA", "TX"],
        }),
      ],
      "/api/stats/states?from=2026-01-01&to=2026-12-31",
    );
    expect(body.CA).toEqual(counts(1, 1));
    expect(body.NV).toEqual(counts(1));
    expect(body.TX).toBeUndefined();
    expect(body.nationwide).toEqual(counts(0, 0, 1));
  });

  it("counts everything without a range", async () => {
    const { body } = await get(
      [recall({ initiatedAt: "2012-02-05", states: ["CA"] })],
      "/api/stats/states",
    );
    expect(body.CA).toEqual(counts(0, 1));
  });
});

describe("summary", () => {
  it("counts active recalls by class and those that began this week, month and year", async () => {
    const { body } = await get(
      [
        recall({ initiatedAt: "2026-11-02", classification: "I" }), // Monday
        recall({ initiatedAt: "2026-11-01", classification: "II", status: "closed" }), // Sunday before
        recall({ initiatedAt: "2026-03-01", classification: null }),
        recall({ initiatedAt: "2025-12-31", classification: "III" }),
      ],
      "/api/stats/summary",
    );
    expect(body.active).toEqual(counts(1, 0, 1, 1));
    expect(body.began).toEqual({ week: 1, month: 2, year: 3 });
  });

  it("gives the median days from start to classification", async () => {
    const { body } = await get(
      [
        recall({ initiatedAt: "2026-01-01", classifiedAt: "2026-01-11" }),
        recall({ initiatedAt: "2026-01-01", classifiedAt: "2026-01-03" }),
        recall({ initiatedAt: "2026-01-01", classifiedAt: "2026-01-05" }),
        recall({ initiatedAt: "2026-01-01", classifiedAt: null }),
      ],
      "/api/stats/summary",
    );
    expect(body.medianDaysToClassification).toBe(4);
  });

  it("has a null median when nothing is classified with a date", async () => {
    expect((await get([], "/api/stats/summary")).body.medianDaysToClassification).toBeNull();
  });
});

describe("date", () => {
  it("counts a recall at its start, or its report date when the start is missing", async () => {
    const { body } = await get(
      [
        recall({ initiatedAt: "2025-03-01", reportedAt: "2026-01-01" }),
        recall({ initiatedAt: null, reportedAt: "2026-01-01" }),
        recall({ initiatedAt: null, reportedAt: null }),
      ],
      "/api/stats/timeseries?interval=year",
    );
    expect(body.periods.map((p: any) => [p.period, p.total])).toEqual([
      ["2025", 1],
      ["2026", 1],
    ]);
  });
});

describe("timeseries range", () => {
  it("is bounded by the snapshot's span, not the requested dates", async () => {
    const { body } = await get(
      [recall({ initiatedAt: "2026-09-10" })],
      "/api/stats/timeseries?interval=month&from=0000-01-01&to=9999-12-31",
    );
    expect(body.periods.map((p: any) => p.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
    const empty = await get([], "/api/stats/timeseries?interval=month&from=0000-01-01");
    expect(empty.body.periods).toEqual([]);
  });
});

describe("hazards", () => {
  const rs = [
    recall({ initiatedAt: "2026-01-05", category: "food", classification: "I", hazard: "listeria" }),
    recall({ initiatedAt: "2026-02-05", category: "food", classification: "I", hazard: "listeria" }),
    recall({ initiatedAt: "2026-02-06", category: "food", classification: null, hazard: "allergen" }),
    recall({ initiatedAt: "2026-03-05", category: "drug", classification: "II", hazard: "cgmp" }),
    recall({ initiatedAt: "2025-12-31", category: "food", classification: "III", hazard: "listeria" }),
    recall({ initiatedAt: null, reportedAt: null, hazard: "other" }),
  ];

  it("counts recalls by hazard and class", async () => {
    const { body } = await get(rs, "/api/stats/hazards");
    expect(body).toEqual({
      listeria: counts(2, 0, 1),
      allergen: counts(0, 0, 0, 1),
      cgmp: counts(0, 1),
    });
  });

  it("filters by category and date range", async () => {
    expect((await get(rs, "/api/stats/hazards?category=food")).body).toEqual({
      listeria: counts(2, 0, 1),
      allergen: counts(0, 0, 0, 1),
    });
    expect((await get(rs, "/api/stats/hazards?from=2026-02-01&to=2026-02-28")).body).toEqual({
      listeria: counts(1),
      allergen: counts(0, 0, 0, 1),
    });
  });

  it("is empty with no snapshot and rejects a bad date", async () => {
    expect((await get([], "/api/stats/hazards")).body).toEqual({});
    expect((await get(rs, "/api/stats/hazards?from=yesterday")).status).toBe(400);
  });
});
