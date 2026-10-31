import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { recall, snapshot } from "./helpers";

describe("GET /api/meta", () => {
  it("returns each source's refreshedAt, count and error", async () => {
    const sources = {
      "openfda-food": { refreshedAt: "2026-01-01T00:00:00.000Z", count: 2, error: null },
      "openfda-drug": { refreshedAt: null, count: 0, error: "down" },
    };
    const app = createApp("/nonexistent", () => snapshot([recall({})], sources));
    expect(await (await app.request("/api/meta")).json()).toEqual(sources);
  });
});
