import type { Recall, RecallCategory } from "../shared/recall.js";
import { parseDistribution } from "./distribution.js";

export type FetchFn = typeof fetch;
export type Endpoint = "food" | "drug" | "device";

/** An enforcement report as openFDA returns it; read only by this file. */
export interface OpenFdaReport {
  status?: string;
  city?: string;
  state?: string;
  classification?: string;
  recalling_firm?: string;
  voluntary_mandated?: string;
  distribution_pattern?: string;
  recall_number: string;
  product_description?: string;
  product_quantity?: string;
  reason_for_recall?: string;
  recall_initiation_date?: string;
  center_classification_date?: string;
  termination_date?: string;
  report_date?: string;
  code_info?: string;
  more_code_info?: string;
}

const BASE = "https://api.fda.gov";
const LIMIT = 1000;
// openFDA rejects skip above 25,000, so a window holding more is split.
const MAX_SKIP = 25000;
const FIRST_YEAR = 2012;
// A stalled request would hold the whole sequential fetch; a timeout fails the source so it keeps its previous records.
const REQUEST_TIMEOUT_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");
const compact = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const parseCompact = (s: string) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));

interface Page {
  results: OpenFdaReport[];
  total: number;
}

async function getPage(
  endpoint: Endpoint,
  from: string,
  to: string,
  skip: number,
  fetchFn: FetchFn,
): Promise<Page> {
  const params = [`search=report_date:[${from}+TO+${to}]`, `limit=${LIMIT}`, `skip=${skip}`];
  if (process.env.OPENFDA_API_KEY) params.push(`api_key=${encodeURIComponent(process.env.OPENFDA_API_KEY)}`);
  const res = await fetchFn(`${BASE}/${endpoint}/enforcement.json?${params.join("&")}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // openFDA answers 404 when nothing matches.
  if (res.status === 404) return { results: [], total: 0 };
  if (!res.ok) throw new Error(`openFDA ${endpoint} returned ${res.status}`);
  const body = (await res.json()) as { meta: { results: { total: number } }; results: OpenFdaReport[] };
  return { results: body.results, total: body.meta.results.total };
}

async function fetchWindow(
  endpoint: Endpoint,
  from: string,
  to: string,
  fetchFn: FetchFn,
  out: OpenFdaReport[],
): Promise<void> {
  const first = await getPage(endpoint, from, to, 0, fetchFn);
  if (first.total > MAX_SKIP + LIMIT) {
    if (from === to) throw new Error(`openFDA ${endpoint} holds more than ${MAX_SKIP + LIMIT} reports on ${from}`);
    const a = parseCompact(from).getTime();
    const mid = new Date(a + Math.floor((parseCompact(to).getTime() - a) / 2 / 86400000) * 86400000);
    const next = new Date(mid.getTime() + 86400000);
    await fetchWindow(endpoint, from, compact(mid), fetchFn, out);
    await fetchWindow(endpoint, compact(next), to, fetchFn, out);
    return;
  }
  out.push(...first.results);
  for (let skip = LIMIT; skip < first.total; skip += LIMIT) {
    out.push(...(await getPage(endpoint, from, to, skip, fetchFn)).results);
  }
}

/** Every report of an endpoint, read by year of report date. */
export async function fetchEndpoint(endpoint: Endpoint, fetchFn: FetchFn, now = new Date()): Promise<OpenFdaReport[]> {
  const out: OpenFdaReport[] = [];
  for (let year = FIRST_YEAR; year <= now.getUTCFullYear(); year++) {
    await fetchWindow(endpoint, `${year}0101`, `${year}1231`, fetchFn, out);
  }
  return out;
}

const iso = (s?: string) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const text = (s?: string) => (s?.trim() ? s.trim() : null);

function classification(s?: string): Recall["classification"] {
  const m = /^Class (I{1,3})$/i.exec(s?.trim() ?? "");
  return m ? (m[1].toUpperCase() as "I" | "II" | "III") : null;
}

function voluntary(s?: string): boolean | null {
  if (/^voluntary/i.test(s ?? "")) return true;
  if (/^mandated/i.test(s ?? "")) return false;
  return null;
}

export function normalizeReport(endpoint: Endpoint, r: OpenFdaReport): Recall {
  const source = `openfda-${endpoint}` as const;
  const category: RecallCategory = endpoint;
  const distributionText = r.distribution_pattern ?? "";
  const d = parseDistribution(distributionText);
  const codeInfo = [r.code_info, r.more_code_info].map(text).filter(Boolean).join("\n");
  return {
    id: `${source}:${r.recall_number}`,
    source,
    category,
    recallNumber: r.recall_number,
    classification: classification(r.classification),
    status: /^(completed|terminated)$/i.test(r.status?.trim() ?? "") ? "closed" : "active",
    product: r.product_description ?? "",
    reason: r.reason_for_recall ?? "",
    firm: r.recalling_firm ?? "",
    firmCity: text(r.city),
    firmState: text(r.state),
    distributionText,
    states: d.states,
    nationwide: d.nationwide,
    foreign: d.foreign,
    locationUnclear: d.unclear,
    quantity: text(r.product_quantity),
    codeInfo: codeInfo || null,
    voluntary: voluntary(r.voluntary_mandated),
    initiatedAt: iso(r.recall_initiation_date),
    reportedAt: iso(r.report_date),
    classifiedAt: iso(r.center_classification_date),
    closedAt: iso(r.termination_date),
    links: [
      {
        label: "openFDA record",
        url: `${BASE}/${endpoint}/enforcement.json?search=recall_number:"${encodeURIComponent(r.recall_number)}"`,
      },
    ],
  };
}
