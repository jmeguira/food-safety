import { buildSnapshot, readSnapshot, writeSnapshot, type Snapshot } from "../ingest/snapshot.js";
import type { FetchFn } from "../ingest/openfda.js";
import type { Source } from "../ingest/sources.js";

export interface Store {
  /** The snapshot being served; null until the first one exists. */
  current(): Snapshot | null;
  /** Builds the next snapshot aside and swaps it in once it is written; a failure keeps the current one. */
  refresh(): Promise<void>;
  /** Loads the snapshot file, refreshes if it is missing or stale, and refreshes on every interval. Returns a stop function. */
  start(): Promise<() => void>;
}

export interface StoreOptions {
  path: string;
  sources: Source[];
  fetchFn: FetchFn;
  refreshHours: number;
  onError?: (e: unknown) => void;
}

export function createStore(opts: StoreOptions): Store {
  const intervalMs = opts.refreshHours * 3_600_000;
  let snapshot: Snapshot | null = null;
  let running: Promise<void> | null = null;

  const run = async () => {
    const next = await buildSnapshot(opts.sources, snapshot, opts.fetchFn);
    await writeSnapshot(opts.path, next);
    snapshot = next;
  };

  const refresh = () => (running ??= run().finally(() => (running = null)));
  const refreshQuietly = () => refresh().catch((e) => opts.onError?.(e));

  return {
    current: () => snapshot,
    refresh,
    async start() {
      try {
        snapshot = await readSnapshot(opts.path);
      } catch (e) {
        opts.onError?.(e);
      }
      const stale = !snapshot || Date.now() - Date.parse(snapshot.generatedAt) >= intervalMs;
      if (stale) await refreshQuietly();
      const timer = setInterval(refreshQuietly, intervalMs);
      timer.unref();
      return () => clearInterval(timer);
    },
  };
}
