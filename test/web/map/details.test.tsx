// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Recall } from "../../../src/shared/recall";
import MapPage from "../../../src/web/pages/map";
import { sinceFor } from "../../../src/web/pages/map/model";

const recall = (o: Partial<Recall>): Recall => ({
  id: "fda-1",
  source: "openfda-food",
  category: "food",
  recallNumber: "F-1",
  classification: "II",
  status: "active",
  product: "Product",
  reason: "Reason",
  firm: "Firm",
  firmCity: null,
  firmState: null,
  distributionText: "CA",
  states: ["CA"],
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
  ...o,
});

const all: Recall[] = [
  recall({ id: "a", product: "II old", classification: "II", initiatedAt: "2026-01-01" }),
  recall({ id: "b", product: "III new", classification: "III", initiatedAt: "2026-09-01" }),
  recall({ id: "c", product: "I old", classification: "I", initiatedAt: "2026-02-01" }),
  recall({ id: "d", product: "I new", classification: "I", reportedAt: "2026-08-01" }),
  recall({ id: "e", product: "Unclassified", classification: null, initiatedAt: "2026-10-01" }),
  recall({ id: "n", product: "Everywhere", nationwide: true, states: ["CA"], classification: "III" }),
  recall({ id: "u", product: "Somewhere", locationUnclear: true, states: [], classification: "II" }),
];
const full = recall({
  id: "full",
  product: "Peanut butter",
  reason: "Salmonella",
  firm: "Acme",
  firmCity: "Fresno",
  firmState: "CA",
  classification: "I",
  quantity: "100 jars",
  codeInfo: "Lot 7",
  distributionText: "CA and NV",
  initiatedAt: "2026-03-01",
  reportedAt: "2026-03-05",
  links: [
    { label: "FDA notice", url: "https://www.fda.gov/notice" },
    { label: "Enforcement report", url: "https://api.fda.gov/report" },
  ],
});

let urls: string[];
beforeEach(() => {
  urls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const u = new URL(url, "http://x");
      if (u.pathname === "/api/meta") return new Response(JSON.stringify({ "openfda-food": { refreshedAt: "2026-10-31T06:00:00.000Z", count: 1, error: null } }));
      if (u.pathname === "/api/states") return new Response(JSON.stringify({ nationwide: { active: { I: 0, II: 0, III: 0, unclassified: 0 }, mostSevere: null } }));
      const one = [...all, full].find((r) => u.pathname === `/api/recalls/${r.id}`);
      if (one) return new Response(JSON.stringify(one));
      if (u.pathname === "/api/recalls") {
        const state = u.searchParams.get("state");
        return new Response(JSON.stringify(state ? all.filter((r) => r.states.includes(state)) : all));
      }
      return new Response("{}", { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = async (entry = "/") => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <MapPage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.querySelector('path[data-state="CA"]')).toBeTruthy());
};
const ca = () => document.querySelector('path[data-state="CA"]')!;
const recalls = () => within(screen.getByRole("region", { name: "Recalls" }));

it("list: a click or Enter on a state lists its active recalls by class, then newest first, under the window", async () => {
  await show();
  fireEvent.click(ca());
  await screen.findByRole("region", { name: "Recalls" });
  const items = recalls().getAllByRole("listitem").map((li) => li.querySelector("button")!.textContent);
  expect(items).toEqual(["I new", "I old", "II old", "III new", "Unclassified"]);
  expect(urls).toContain(`/api/recalls?status=active&since=${sinceFor("365")}&state=CA`);
  expect(recalls().getByText("last 12 months")).toBeTruthy();
  cleanup();

  await show();
  fireEvent.keyDown(ca(), { key: "Enter" });
  await screen.findByRole("region", { name: "Recalls" });
  expect(recalls().getAllByRole("listitem")).toHaveLength(5);
});

it("list: nationwide recalls join a state's list only when added", async () => {
  await show("/?state=CA");
  await screen.findByRole("region", { name: "Recalls" });
  expect(recalls().queryByText("Everywhere")).toBeNull();
  fireEvent.click(screen.getByLabelText(/nationwide recalls to every state/i));
  expect(recalls().getByText("Everywhere")).toBeTruthy();
});

it("detail: shows every field the source gave, with links, and leaves out the empty ones", async () => {
  await show("/?state=CA&recall=full");
  const d = within(await screen.findByRole("article", { name: "Recall detail" }));
  for (const t of ["Peanut butter", "Salmonella", "Acme", "Fresno", "100 jars", "Lot 7", "CA and NV", "2026-03-01", "2026-03-05", "active"])
    expect(d.getByText(t)).toBeTruthy();
  expect(d.getByText(/Class I: A reasonable probability/)).toBeTruthy();
  expect(d.getByRole("link", { name: "FDA notice" }).getAttribute("href")).toBe("https://www.fda.gov/notice");
  expect(d.getByRole("link", { name: "Enforcement report" }).getAttribute("href")).toBe("https://api.fda.gov/report");
  expect(d.queryByText("Classified")).toBeNull();
  expect(d.queryByText("Closed")).toBeNull();
  expect(d.getByText(/refreshed 2026-10-31T06:00:00.000Z.*notice is the authority/)).toBeTruthy();
});

it("detail: says so when the recall cannot be loaded", async () => {
  await show("/?recall=missing");
  expect((await screen.findByRole("alert")).textContent).toContain("Could not load the recall");
});

it("lists: nationwide, location unclear and not yet classified are reachable from the map", async () => {
  await show();
  const other = within(screen.getByRole("region", { name: "Other lists" }));
  const names = async (button: string) => {
    fireEvent.click(other.getByRole("button", { name: button }));
    await waitFor(() => expect(recalls().getAllByRole("listitem").length).toBeGreaterThan(0));
    return recalls().getAllByRole("listitem").map((li) => li.querySelector("button")!.textContent);
  };
  expect(await names("Nationwide")).toEqual(["Everywhere"]);
  expect(await names("Location unclear")).toEqual(["Somewhere"]);
  expect(await names("Announced, not yet classified")).toEqual(["Unclassified"]);
  expect(urls.every((u) => !u.includes("state="))).toBe(true);
});

it("url: the chosen state and recall are in the address, and an address opens them", async () => {
  await show("/?state=CA");
  await screen.findByRole("region", { name: "Recalls" });
  expect(recalls().getAllByRole("listitem")).toHaveLength(5);
  cleanup();

  await show("/?state=CA&recall=full");
  expect(await screen.findByRole("article", { name: "Recall detail" })).toBeTruthy();
  expect(urls).toContain("/api/recalls/full");
  fireEvent.click(screen.getByRole("button", { name: "Back to the list" }));
  await screen.findByRole("region", { name: "Recalls" });
  expect(screen.queryByRole("article")).toBeNull();
});

it("url: choosing a state and a recall opens them, and going back returns to the state", async () => {
  await show();
  fireEvent.click(ca());
  await screen.findByRole("region", { name: "Recalls" });
  fireEvent.click(recalls().getByRole("button", { name: "I new" }));
  const d = within(await screen.findByRole("article", { name: "Recall detail" }));
  expect(d.getByText("I new")).toBeTruthy();
  expect(urls).toContain("/api/recalls/d");
});
