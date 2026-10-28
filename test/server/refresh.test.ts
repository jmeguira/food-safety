import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSnapshot, writeSnapshot } from "../../src/ingest/snapshot.js";
import type { Source } from "../../src/ingest/sources.js";
import { createStore } from "../../src/server/store.js";
import { recall, snapshot } from "./helpers";

const noFetch = (async () => new Response()) as typeof fetch;
const path = () => join(mkdtempSync(join(tmpdir(), "store-")), "snapshot.json");
const source = (fetchRecords: () => Promise<unknown[]>): Source => ({
  id: "openfda-food",
  fetch: fetchRecords,
  normalize: (raw) => raw as ReturnType<typeof recall>,
});

afterEach(() => vi.useRealTimers());

describe("snapshot refresh", () => {
  it("refreshes on start when there is no snapshot", async () => {
    const p = path();
    const store = createStore({ path: p, sources: [source(async () => [recall({ id: "x" })])], fetchFn: noFetch, refreshHours: 6 });
    const stop = await store.start();
    stop();
    expect(store.current()?.recalls.map((r) => r.id)).toEqual(["x"]);
    expect((await readSnapshot(p))?.recalls).toHaveLength(1);
  });

  it("refreshes on start when the snapshot is older than the interval", async () => {
    const p = path();
    await writeSnapshot(p, { ...snapshot([recall({ id: "old" })]), generatedAt: new Date(Date.now() - 7 * 3_600_000).toISOString() });
    const store = createStore({ path: p, sources: [source(async () => [recall({ id: "new" })])], fetchFn: noFetch, refreshHours: 6 });
    (await store.start())();
    expect(store.current()?.recalls.map((r) => r.id)).toEqual(["new"]);
  });

  it("serves a recent snapshot on start without fetching", async () => {
    const p = path();
    await writeSnapshot(p, { ...snapshot([recall({ id: "old" })]), generatedAt: new Date().toISOString() });
    const fetchRecords = vi.fn(async () => []);
    const store = createStore({ path: p, sources: [source(fetchRecords)], fetchFn: noFetch, refreshHours: 6 });
    (await store.start())();
    expect(fetchRecords).not.toHaveBeenCalled();
    expect(store.current()?.recalls.map((r) => r.id)).toEqual(["old"]);
  });

  it("re-runs the ingest every interval", async () => {
    vi.useFakeTimers();
    const fetchRecords = vi.fn(async () => [recall({})]);
    const store = createStore({ path: path(), sources: [source(fetchRecords)], fetchFn: noFetch, refreshHours: 2 });
    const stop = await store.start();
    expect(fetchRecords).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(fetchRecords).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps serving the old snapshot until the new one is written", async () => {
    const p = path();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const store = createStore({
      path: p,
      sources: [source(async () => (++calls === 1 ? [recall({ id: "one" })] : (await gate, [recall({ id: "two" })])))],
      fetchFn: noFetch,
      refreshHours: 6,
    });
    await store.refresh();
    const second = store.refresh();
    expect(store.current()?.recalls[0].id).toBe("one");
    release();
    await second;
    expect(store.current()?.recalls[0].id).toBe("two");
  });

  it("keeps the current snapshot when writing the next one fails", async () => {
    const p = path();
    const store = createStore({ path: p, sources: [source(async () => [recall({ id: "one" })])], fetchFn: noFetch, refreshHours: 6 });
    await store.refresh();
    const broken = createStore({ path: join(p, "no", "dir"), sources: [source(async () => [])], fetchFn: noFetch, refreshHours: 6 });
    await expect(broken.refresh()).rejects.toThrow();
    expect(broken.current()).toBeNull();
    expect(store.current()?.recalls[0].id).toBe("one");
  });

  it("keeps a failed source's records in the served snapshot", async () => {
    let fail = false;
    const store = createStore({
      path: path(),
      sources: [source(async () => { if (fail) throw new Error("boom"); return [recall({ id: "one" })]; })],
      fetchFn: noFetch,
      refreshHours: 6,
    });
    await store.refresh();
    fail = true;
    await store.refresh();
    expect(store.current()?.recalls.map((r) => r.id)).toEqual(["one"]);
    expect(store.current()?.sources["openfda-food"].error).toBe("boom");
  });
});
