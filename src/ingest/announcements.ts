import type { Recall, RecallCategory } from "../shared/recall.js";
import { parseDistribution } from "./distribution.js";
import type { FetchFn } from "./openfda.js";

export const FEED_URL = "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml";
const ORIGIN = "https://www.fda.gov";
// fda.gov is asked for at most one page a second.
const REQUEST_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 60_000;

interface FeedItem {
  url: string;
  title: string;
  description: string;
  pubDate: string;
}

/** What an announcement page says; read only by this file. */
interface Page {
  productType: string;
  product: string | null;
  reason: string | null;
  firm: string | null;
  announcedAt: string | null;
  /** The announcement's sentences that say where the product went. */
  distributionText: string;
}

/** A feed item with its page, or null when the page could not be loaded or read; a cached item carries the Recall already built. */
export interface Announcement {
  item: FeedItem;
  page: Page | null;
  cached?: Recall;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (m, dec, hex, name) =>
    dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (ENTITIES[name.toLowerCase()] ?? m),
  );
const plain = (html: string) =>
  decode(html.replace(/<div class="field--label">[\s\S]*?<\/div>/g, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue, 27 Oct 2026 14:18:00 EDT" as written, without a time zone shifting the day. */
function pubDate(s: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/.exec(s);
  const month = m ? MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()) : -1;
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function parseFeed(xml: string): FeedItem[] {
  if (!/<rss[\s>]/.test(xml) || !/<channel[\s>]/.test(xml)) throw new Error("FDA recalls feed is not an RSS feed");
  const tag = (block: string, name: string) => {
    const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
    if (!m) return "";
    const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
    return (cdata ? cdata[1] : decode(m[1])).trim();
  };
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([block]) => ({
    url: new URL(tag(block, "link"), ORIGIN).href.replace(/^http:/, "https:"),
    title: tag(block, "title"),
    description: tag(block, "description"),
    pubDate: tag(block, "pubDate"),
  }));
}

/** Stands in for the firm of a parsed page that names none, so an empty firm marks a failed page alone. */
const UNNAMED_FIRM = "Not named";

const DISTRIBUTION_SENTENCE = /distribu|shipp|\bsold\b|nationwide|nationally|\bstates\b|retail|available (?:in|at)|sent to/i;

function term(html: string, label: string): string | null {
  const m = new RegExp(`<dt[^>]*>\\s*${label}:\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`).exec(html);
  return m ? m[1] : null;
}

/** Null when the page is not an announcement page. */
export function parsePage(html: string): Page | null {
  const start = html.indexOf('id="recall-announcement"');
  const type = term(html, "Product Type");
  if (start < 0 || type === null) return null;
  const next = html.indexOf("<h2", start + 1);
  const body = plain(html.slice(start, next < 0 ? undefined : next)).replace(/^Company Announcement\s*/, "");
  const field = (label: string) => {
    const v = term(html, label);
    return v === null ? null : plain(v) || null;
  };
  const announced = /<dt[^>]*>\s*Company Announcement Date:\s*<\/dt>\s*<dd[^>]*>\s*<time datetime="(\d{4}-\d{2}-\d{2})/.exec(html);
  return {
    productType: plain(type.split(/<br\s*\/?>/)[0]),
    product: field("Product Description"),
    reason: field("Reason for Announcement"),
    firm: field("Company Name"),
    announcedAt: announced ? announced[1] : null,
    distributionText: body.split(/(?<=[.!?])\s+/).filter((s) => DISTRIBUTION_SENTENCE.test(s)).join(" "),
  };
}

function category(productType: string): RecallCategory {
  if (/^drugs?\b/i.test(productType)) return "drug";
  if (/device/i.test(productType)) return "device";
  // Food, beverages and supplements; a type with no category of its own (cosmetics, veterinary) is filed here too.
  return "food";
}

export function normalizeAnnouncement({ item, page, cached }: Announcement): Recall {
  if (cached) return cached;
  const path = new URL(item.url).pathname;
  const d = parseDistribution(page?.distributionText ?? "");
  return {
    id: `fda-announcement:${path}`,
    source: "fda-announcement",
    category: page ? category(page.productType) : "food",
    recallNumber: path.split("/").pop() ?? path,
    classification: null,
    status: "active",
    product: page?.product ?? item.title,
    reason: page?.reason ?? item.description,
    firm: page ? (page.firm ?? UNNAMED_FIRM) : "",
    firmCity: null,
    firmState: null,
    distributionText: page?.distributionText ?? "",
    states: d.states,
    nationwide: d.nationwide,
    foreign: d.foreign,
    locationUnclear: d.unclear,
    quantity: null,
    codeInfo: null,
    voluntary: null,
    initiatedAt: page?.announcedAt ?? null,
    reportedAt: pubDate(item.pubDate),
    classifiedAt: null,
    closedAt: null,
    links: [{ label: "FDA announcement", url: item.url }],
  };
}

export interface AnnouncementDeps {
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The feed's items with their pages. A page that fails keeps its item; only a feed that fails fails the source. */
export async function fetchAnnouncements(
  fetchFn: FetchFn,
  previous: Recall[] = [],
  deps: AnnouncementDeps = {},
): Promise<Announcement[]> {
  const { sleep = wait } = deps;
  const get = (url: string) => fetchFn(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  const res = await get(FEED_URL);
  if (!res.ok) throw new Error(`FDA recalls feed returned ${res.status}`);
  const items = parseFeed(await res.text());

  // A failed page leaves the firm empty (the feed does not name it), so it is read again; a parsed page never does, whether or not it named a firm or a distribution.
  const read = new Map<string, Recall>();
  for (const r of previous) if (r.source === "fda-announcement" && r.firm !== "") read.set(r.links[0]?.url, r);

  const out: Announcement[] = [];
  // The feed was just requested.
  let requested = true;
  for (const item of items) {
    const cached = read.get(item.url);
    if (cached) {
      out.push({ item, page: null, cached });
      continue;
    }
    if (requested) await sleep(REQUEST_INTERVAL_MS);
    requested = true;
    let page: Page | null = null;
    try {
      const r = await get(item.url);
      if (r.ok) page = parsePage(await r.text());
    } catch {
      // The item is kept with what the feed gave.
    }
    out.push({ item, page });
  }
  return out;
}
