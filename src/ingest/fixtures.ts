import { readFile } from "node:fs/promises";
import type { FetchFn, OpenFdaReport } from "./openfda.js";

const DIR = new URL("../../test/fixtures/openfda/", import.meta.url);
const ANNOUNCEMENTS = new URL("../../test/fixtures/announcements/", import.meta.url);

/** The recorded announcement feed, and the recorded page of each announcement; an announcement with no recording answers 404. */
async function announcementFetch(url: URL): Promise<Response> {
  const file = url.pathname.endsWith("/rss.xml") ? "feed.xml" : `pages/${url.pathname.split("/").pop()}.html`;
  try {
    return new Response(await readFile(new URL(file, ANNOUNCEMENTS), "utf8"));
  } catch {
    return new Response("not found", { status: 404 });
  }
}

/** A fetch that answers openFDA enforcement queries and fda.gov announcements from the recorded responses, honoring the report_date window, limit and skip. */
export const fixtureFetch: FetchFn = async (input) => {
  const url = new URL(String(input));
  if (url.hostname === "www.fda.gov") return announcementFetch(url);
  const endpoint = url.pathname.split("/")[1];
  const recorded = JSON.parse(await readFile(new URL(`${endpoint}.json`, DIR), "utf8")) as { results: OpenFdaReport[] };
  const [, from, to] = /\[(\d+) TO (\d+)\]/.exec(url.searchParams.get("search") ?? "") ?? [];
  const inWindow = recorded.results.filter((r) => r.report_date! >= from && r.report_date! <= to);
  const skip = Number(url.searchParams.get("skip") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  if (inWindow.length === 0) return new Response("{}", { status: 404 });
  return Response.json({ meta: { results: { skip, limit, total: inWindow.length } }, results: inWindow.slice(skip, skip + limit) });
};
