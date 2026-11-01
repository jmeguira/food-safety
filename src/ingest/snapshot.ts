import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RawRecall, Recall } from "../shared/recall.js";
import { hazardOf } from "./hazard.js";
import { mergeAnnouncements } from "./match.js";
import type { FetchFn } from "./openfda.js";
import type { Source } from "./sources.js";

export interface SourceStatus {
  /** When the source's records last came from a successful fetch; null if never. */
  refreshedAt: string | null;
  count: number;
  error: string | null;
}

export interface Snapshot {
  generatedAt: string;
  sources: Record<string, SourceStatus>;
  recalls: Recall[];
}

/** The hazard is set here, over every source's records, so a source never assigns its own. */
const withHazard = (r: RawRecall): Recall => ({ ...r, hazard: hazardOf(r.reason, r.category) });

/** A source that fails keeps the records of the previous snapshot, so a failed fetch never shrinks it. */
export async function buildSnapshot(
  sources: Source[],
  previous: Snapshot | null,
  fetchFn: FetchFn,
  now = new Date(),
): Promise<Snapshot> {
  const status: Record<string, SourceStatus> = {};
  const recalls: RawRecall[] = [];
  for (const source of sources) {
    const kept = previous?.recalls.filter((r) => r.source === source.id) ?? [];
    try {
      const fresh = (await source.fetch(fetchFn, kept)).map((raw) => source.normalize(raw));
      recalls.push(...fresh);
      status[source.id] = { refreshedAt: now.toISOString(), count: fresh.length, error: null };
    } catch (e) {
      recalls.push(...kept);
      status[source.id] = {
        refreshedAt: previous?.sources[source.id]?.refreshedAt ?? null,
        count: kept.length,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return { generatedAt: now.toISOString(), sources: status, recalls: mergeAnnouncements(recalls).map(withHazard) };
}

export async function readSnapshot(path: string): Promise<Snapshot | null> {
  try {
    const snap = JSON.parse(await readFile(path, "utf8")) as Snapshot;
    snap.recalls = snap.recalls.map((r) => (r.hazard ? r : withHazard(r)));
    return snap;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function writeSnapshot(path: string, snapshot: Snapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot));
  await rename(tmp, path);
}
