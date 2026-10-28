import { fixtureFetch } from "./fixtures.js";
import { buildSnapshot, readSnapshot, writeSnapshot } from "./snapshot.js";
import { SOURCES } from "./sources.js";

const PATH = "data/snapshot.json";

const snapshot = await buildSnapshot(
  SOURCES,
  await readSnapshot(PATH),
  process.argv.includes("--fixtures") ? fixtureFetch : fetch,
);
await writeSnapshot(PATH, snapshot);
for (const [id, s] of Object.entries(snapshot.sources)) {
  console.log(`${id}: ${s.count} recalls${s.error ? `, failed: ${s.error}` : ""}`);
}
if (Object.values(snapshot.sources).some((s) => s.error)) process.exitCode = 1;
