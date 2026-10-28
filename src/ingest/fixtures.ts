import { readFile } from "node:fs/promises";
import type { FetchFn, OpenFdaReport } from "./openfda.js";

const DIR = new URL("../../test/fixtures/openfda/", import.meta.url);

/** A fetch that answers openFDA enforcement queries from the recorded responses, honoring the report_date window, limit and skip. */
export const fixtureFetch: FetchFn = async (input) => {
  const url = new URL(String(input));
  const endpoint = url.pathname.split("/")[1];
  const recorded = JSON.parse(await readFile(new URL(`${endpoint}.json`, DIR), "utf8")) as { results: OpenFdaReport[] };
  const [, from, to] = /\[(\d+) TO (\d+)\]/.exec(url.searchParams.get("search") ?? "") ?? [];
  const inWindow = recorded.results.filter((r) => r.report_date! >= from && r.report_date! <= to);
  const skip = Number(url.searchParams.get("skip") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  if (inWindow.length === 0) return new Response("{}", { status: 404 });
  return Response.json({ meta: { results: { skip, limit, total: inWindow.length } }, results: inWindow.slice(skip, skip + limit) });
};
