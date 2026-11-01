// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Dashboard from "../../../src/web/pages/dashboard";

const counts = (I = 0, II = 0, III = 0, unclassified = 0) => ({ I, II, III, unclassified });

const responses: Record<string, unknown> = {
  "/api/stats/summary": {
    active: counts(4, 3, 2, 1),
    began: { week: 1, month: 7, year: 40 },
    medianDaysToClassification: 12,
  },
  "/api/meta": {
    "openfda-food": { refreshedAt: "2026-11-01T06:00:00Z", count: 10, error: null },
    fsis: { refreshedAt: null, count: 0, error: "down" },
  },
  "/api/stats/timeseries": {
    interval: "year",
    periods: [
      { period: "2024", counts: counts(1, 2, 0, 0), total: 3 },
      { period: "2025", counts: counts(5, 1, 1, 0), total: 7 },
    ],
    earliest: { fsis: "2012-01-03", "openfda-food": "2004-10-20" },
  },
  "/api/stats/hazards": {
    listeria: counts(9, 1, 0, 0),
    allergen: counts(2, 8, 4, 0),
    "foreign-material": counts(0, 1, 6, 0),
  },
  "/api/stats/states": {
    CA: counts(3, 3, 0, 0),
    TX: counts(1, 0, 0, 0),
    nationwide: counts(2, 0, 0, 0),
  },
};

let calls: string[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url); 
      const body = responses[url.split("?")[0]!];
      return body === undefined
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify(body));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = (url = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Dashboard />
    </MemoryRouter>,
  );

const showTable = async (title: string) => {
  const section = await screen.findByRole("region", { name: title });
  fireEvent.click(await within(section).findByRole("button", { name: "Table" }));
  return section;
};

it("summary shows active recalls by class, this month, the median and each source's freshness", async () => {
  open();
  const section = await screen.findByRole("region", { name: "Summary" });
  await waitFor(() => expect(section.textContent).toContain("Active Class I: 4"));
  expect(section.textContent).toContain("Active Unclassified: 1");
  expect(section.textContent).toContain("Begun this month: 7");
  expect(section.textContent).toContain("Median days to classification: 12");
  expect(section.textContent).toContain("openfda-food: refreshed 2026-11-01T06:00:00Z");
  expect(section.textContent).toContain("fsis: never refreshed (error: down)");
});

it("timeseries stacks by class, follows the range and interval, and says where each history starts", async () => {
  open("/dashboard?from=2024-01-01&to=2025-12-31&interval=month&class=I");
  await screen.findByRole("region", { name: "Recalls over time" });
  await waitFor(() =>
    expect(calls).toContain("/api/stats/timeseries?interval=month&class=I&from=2024-01-01&to=2025-12-31"),
  );
  const section = await showTable("Recalls over time");
  expect(section.textContent).toContain("History starts: fsis 2012-01-03, openfda-food 2004-10-20");
  expect(within(section).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
    "Period",
    "Class I",
    "Total",
  ]);
});

it("hazards and states lead by count, in plain words, following the class filter", async () => {
  open("/dashboard?class=II");
  const hazards = await showTable("Leading hazards");
  const rows = within(hazards).getAllByRole("row").slice(1).map((r) => r.firstChild?.textContent);
  expect(rows).toEqual(["Undeclared allergen", "Listeria", "Foreign material"]);
  const states = await showTable("States with the most recalls");
  const stateRows = within(states).getAllByRole("row").slice(1).map((r) => r.firstChild?.textContent);
  expect(stateRows).toEqual(["California"]);
});

it("hazards and states follow the category: states are counted from the category's recalls", async () => {
  responses["/api/recalls"] = [
    { initiatedAt: "2025-03-01", reportedAt: null, classification: "I", nationwide: false, states: ["TX", "OK"] },
    { initiatedAt: "2020-03-01", reportedAt: null, classification: "I", nationwide: false, states: ["TX"] },
    { initiatedAt: null, reportedAt: "2025-04-01", classification: null, nationwide: true, states: ["TX", "OK"] },
  ];
  open("/dashboard?category=food&from=2025-01-01");
  const states = await showTable("States with the most recalls");
  const rows = within(states).getAllByRole("row").slice(1).map((r) => r.textContent);
  expect(rows).toEqual(["Texas10001", "Oklahoma10001", "Nationwide00011"]);
  expect(calls).toContain("/api/recalls?category=food");
  expect(calls.some((c) => c.startsWith("/api/stats/hazards?category=food&from=2025-01-01"))).toBe(true);
  delete responses["/api/recalls"];
});

it("url keeps the filters, and changing one rewrites it", async () => {
  open("/dashboard?category=drug&class=III&from=2024-01-01&to=2024-12-31&interval=month&junk=1");
  const form = await screen.findByRole("form", { name: "Filters" });
  expect((within(form).getByLabelText("Category") as HTMLSelectElement).value).toBe("drug");
  expect((within(form).getByLabelText("Class") as HTMLSelectElement).value).toBe("III");
  expect((within(form).getByLabelText("From") as HTMLInputElement).value).toBe("2024-01-01");
  expect((within(form).getByLabelText("To") as HTMLInputElement).value).toBe("2024-12-31");
  expect((within(form).getByLabelText("Group by") as HTMLSelectElement).value).toBe("month");
  fireEvent.change(within(form).getByLabelText("Class"), { target: { value: "I" } });
  await waitFor(() =>
    expect(calls).toContain("/api/stats/timeseries?interval=month&category=drug&class=I&from=2024-01-01&to=2024-12-31"),
  );
});

it("table gives every chart a table of its numbers", async () => {
  open();
  for (const title of ["Recalls over time", "Leading hazards", "States with the most recalls"]) {
    const section = await showTable(title);
    expect(within(section).getByRole("table")).toBeTruthy();
  }
  const time = screen.getByRole("region", { name: "Recalls over time" });
  expect(within(time).getAllByRole("row").map((r) => r.textContent)).toEqual([
    "PeriodClass IClass IIClass IIIUnclassifiedTotal",
    "20241200" + "3",
    "20255110" + "7",
  ]);
});
