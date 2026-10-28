import path from "node:path";
import { serve } from "@hono/node-server";
import { SOURCES } from "../ingest/sources.js";
import { createApp } from "./app.js";
import { createStore } from "./store.js";

const hours = Number(process.env.REFRESH_HOURS);
const port = Number(process.env.PORT ?? 3000);
const store = createStore({
  path: path.resolve("data/snapshot.json"),
  sources: SOURCES,
  fetchFn: fetch,
  refreshHours: hours > 0 ? hours : 6,
  onError: (e) => console.error("refresh failed:", e),
});
const app = createApp(path.resolve("dist/web"), store.current);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`listening on http://localhost:${info.port}`);
});

// Serving starts before the first refresh ends; endpoints answer empty until a snapshot exists.
void store.start();
