import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { recall, snapshot } from "./helpers";

const snap = snapshot([
  recall({ id: "a", classification: "I", states: ["CA", "NV"] }),
  recall({ id: "b", classification: "II", status: "closed", states: ["CA"] }),
  recall({ id: "c", classification: null, category: "drug", states: ["TX"] }),
  recall({ id: "d", classification: "I", category: "device", nationwide: true, states: ["CA", "TX"] }),
]);
const app = createApp("/nonexistent", () => snap);
const ids = async (qs: string) => ((await (await app.request(`/api/recalls${qs}`)).json()) as { id: string }[]).map((r) => r.id);

describe("GET /api/recalls", () => {
  it("returns every recall without filters", async () => {
    expect(await ids("")).toEqual(["a", "b", "c", "d"]);
  });

  it.each([
    ["?status=active", ["a", "c", "d"]],
    ["?status=closed", ["b"]],
    ["?category=drug", ["c"]],
    ["?class=I", ["a", "d"]],
    ["?class=unclassified", ["c"]],
    ["?state=CA", ["a", "b", "d"]],
    ["?status=active&class=I&state=ca", ["a", "d"]],
    ["?state=ZZ", []],
  ])("filters by %s", async (qs, expected) => {
    expect(await ids(qs)).toEqual(expected);
  });

  it("is empty before a snapshot exists", async () => {
    const res = await createApp("/nonexistent").request("/api/recalls");
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /api/recalls/:id", () => {
  it("returns one recall by id", async () => {
    const res = await app.request("/api/recalls/c");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "c", category: "drug" });
  });

  it("returns 404 for an unknown id", async () => {
    expect((await app.request("/api/recalls/nope")).status).toBe(404);
  });
});
