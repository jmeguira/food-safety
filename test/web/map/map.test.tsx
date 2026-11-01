// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MetaResponse, StateSummary, StatesResponse } from "../../../src/shared/api";
import { severity } from "../../../src/web/severity";
import { MemoryRouter } from "react-router-dom";
import MapPage from "../../../src/web/pages/map";
import { sinceFor } from "../../../src/web/pages/map/model";

const counts = (I = 0, II = 0, III = 0, unclassified = 0) => ({ I, II, III, unclassified });
const summary = (c: ReturnType<typeof counts>): StateSummary => ({
  active: c,
  mostSevere: c.I ? "I" : c.II ? "II" : c.III ? "III" : c.unclassified ? "unclassified" : null,
});

const full: StatesResponse = {
  nationwide: summary(counts(1)),
  CA: summary(counts(2, 1)),
  TX: summary(counts(0, 0, 3)),
  PR: summary(counts(0, 2)),
};
const recent: StatesResponse = { nationwide: summary(counts()), CA: summary(counts(0, 1)) };
const drugs: StatesResponse = { nationwide: summary(counts()), CA: summary(counts(0, 1)), TX: summary(counts(1)) };

const meta: MetaResponse = {
  "openfda-food": { refreshedAt: "2026-10-31T06:00:00.000Z", count: 10, error: null },
  fsis: { refreshedAt: null, count: 0, error: "HTTP 503" },
};

let urls: string[];
beforeEach(() => {
  urls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const body = url.startsWith("/api/meta")
        ? meta
        : url.includes("category=drug")
          ? drugs
          : url.includes("since=")
            ? recent
            : full;
      return new Response(JSON.stringify(body));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const path = (code: string) => document.querySelector(`path[data-state="${code}"]`)!;
const shade = (code: string) => path(code).getAttribute("data-severity");
const open = async () => {
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  await waitFor(() => expect(path("CA")).toBeTruthy());
};
const openAll = async () => {
  await open();
  choose("Began within", "all");
  await waitFor(() => expect(shade("TX")).not.toBe("none"));
};
const choose = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

it("draws states shaded by their most severe active recall, unshaded with none, with a legend", async () => {
  await open();
  expect(document.querySelectorAll("path[data-state]").length).toBeGreaterThanOrEqual(51);
  expect(path("CA").getAttribute("fill")).toBe(severity.II.color);
  expect(shade("NV")).toBe("none");
  const legend = within(screen.getByRole("region", { name: "Legend" }));
  for (const c of Object.values(severity)) {
    expect(legend.getByText(c.label)).toBeTruthy();
    expect(legend.getByText(new RegExp(c.meaning.slice(0, 20)))).toBeTruthy();
  }
});

it("lists territories under the map with their counts", async () => {
  await openAll();
  expect(screen.getByText("Puerto Rico: Class II 2")).toBeTruthy();
});

it("window: opens on the last 12 months and says so, then all ongoing sends no since", async () => {
  await open();
  const since = sinceFor("365")!;
  expect(urls).toContain(`/api/states?since=${since}`);
  expect(screen.getByText("last 12 months", { selector: "strong" })).toBeTruthy();
  expect(shade("CA")).toBe("II");
  expect(shade("TX")).toBe("none");

  choose("Began within", "all");
  await waitFor(() => expect(shade("TX")).toBe("III"));
  expect(urls).toContain("/api/states");
  expect(shade("CA")).toBe("I");
  expect(screen.getByText("all ongoing", { selector: "strong" })).toBeTruthy();

  choose("Began within", "90");
  await waitFor(() => expect(urls.some((u) => u.includes(`since=${sinceFor("90")}`))).toBe(true));
});

it("window: computes since from today", () => {
  const today = new Date(2026, 9, 31);
  expect(sinceFor("90", today)).toBe("2026-08-02");
  expect(sinceFor("365", today)).toBe("2025-10-31");
  expect(sinceFor("all", today)).toBeUndefined();
});

it("nationwide: shows its own panel by class and a toggle adds it to every state", async () => {
  await openAll();
  const panel = within(screen.getByRole("region", { name: "Nationwide recalls" }));
  expect(panel.getByText("Class I: 1")).toBeTruthy();
  expect(shade("TX")).toBe("III");

  fireEvent.click(screen.getByLabelText(/nationwide recalls to every state/i));
  expect(shade("TX")).toBe("I");
  expect(shade("NV")).toBe("I");
  expect(panel.getByText("Class I: 1")).toBeTruthy();
});

it("filter: category refetches the shading and class narrows the shading and counts", async () => {
  await open();
  expect(shade("TX")).toBe("none");
  choose("Category", "drug");
  await waitFor(() => expect(shade("TX")).toBe("I"));
  expect(urls.some((u) => u.includes("category=drug"))).toBe(true);

  choose("Class", "II");
  expect(shade("TX")).toBe("none");
  expect(shade("CA")).toBe("II");
  fireEvent.focus(path("CA"));
  expect(screen.getByRole("tooltip").textContent).toContain("Class I: 0");
  expect(screen.getByRole("tooltip").textContent).toContain("Class II: 1");
});

it("tooltip: hover or focus names the state and its recalls by class", async () => {
  await openAll();
  fireEvent.mouseEnter(path("CA"));
  const tip = screen.getByRole("tooltip");
  expect(tip.textContent).toContain("California");
  expect(tip.textContent).toContain("Class I: 2");
  expect(tip.textContent).toContain("Class II: 1");
  fireEvent.mouseLeave(path("CA"));
  fireEvent.focus(path("TX"));
  expect(tip.textContent).toContain("Texas");
  expect(tip.textContent).toContain("Class III: 3");
  expect(path("TX").getAttribute("tabindex")).toBe("0");
  expect(path("TX").getAttribute("aria-label")).toContain("Class III 3");
});

it("freshness: says when each source was refreshed and flags a failed one", async () => {
  await open();
  const section = within(await screen.findByRole("region", { name: "Data freshness" }));
  expect(section.getByText(/openfda-food: refreshed 2026-10-31T06:00:00.000Z/)).toBeTruthy();
  expect(section.getByText(/fsis: never refreshed/)).toBeTruthy();
  expect(section.getByRole("alert").textContent).toContain("Refresh failed: HTTP 503");
  expect(section.getAllByRole("alert")).toHaveLength(1);
});

it("window: keeps no label or shading from the old window while the new one loads", async () => {
  await open();
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  choose("Began within", "all");
  await waitFor(() => expect(screen.getByText("Loading…")).toBeTruthy());
  expect(screen.queryByText("last 12 months", { selector: "strong" })).toBeNull();
  expect(screen.queryByText("all ongoing", { selector: "strong" })).toBeNull();
  expect(document.querySelector("path[data-state]")).toBeNull();
});

it("freshness: says so when the meta request fails", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).startsWith("/api/meta") ? new Response("", { status: 500 }) : new Response(JSON.stringify(full)),
  );
  render(<MemoryRouter><MapPage /></MemoryRouter>);
  expect(await screen.findByText("Freshness unavailable.")).toBeTruthy();
});
