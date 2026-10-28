[README](../README.md) · **architecture** · [product](product.md) · [glossary](glossary.md)

# Architecture

One Node process serves the [API](glossary.md#api) and the built web app; a React single-page app is the UI.

```
browser ── React app ── fetch /api ──▶ Hono server ──▶ (snapshot)
                 ▲                         │
                 └──── static files / shell┘
```

## Parts

| Part | Where | Responsibility |
|---|---|---|
| Server | `src/server/` | `createApp(webRoot, current)` in `app.ts` builds the Hono app; `api.ts` holds the API routes; `store.ts` holds the [snapshot](glossary.md#snapshot) in memory and refreshes it; `main.ts` starts it on `PORT` (default 3000), serving `dist/web` |
| Web | `src/web/` | React app routed with react-router: `/` is the Map page, `/dashboard` the Dashboard; both are placeholders |
| Severity | `src/shared/severity.ts`, `src/web/severity.ts` | the [severity class](glossary.md#severity-class) type, and its label, color and meaning for display |
| Shared | `src/shared/` | types used by both server and web; `api.ts` holds the request and response types of the API |
| States | `src/shared/states.ts` | the 50 states, DC and the territories, each with USPS code, name and FIPS code; records carry USPS codes, the map joins on FIPS |
| Recall | `src/shared/recall.ts` | the `Recall` model every [source](glossary.md#source) normalizes to |
| Ingest | `src/ingest/` | `distribution.ts` turns a [distribution pattern](glossary.md#distribution-pattern) into states; `openfda.ts` fetches and normalizes openFDA; `announcements.ts` fetches and normalizes FDA [announcements](glossary.md#announcement); `sources.ts` lists the sources; `snapshot.ts` builds and writes the [snapshot](glossary.md#snapshot); `main.ts` is `npm run ingest` |
| Tests | `test/` | vitest; `test/fixtures/distribution.json` holds real distribution patterns from openFDA food, drug and device enforcement reports, each with its expected result |

## Server

`app.ts` handles requests in this order:

1. `/api/health` and the routes in the table below.
2. Any other `/api/*` returns 404 JSON, so an unknown API path never falls through to the [shell](glossary.md#shell).
3. Static files from the web root.
4. Any other path returns `index.html`, so client routes load directly.

### API

Every route reads the snapshot the store holds at the moment of the request; none reads a source.

| Route | Returns |
|---|---|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/recalls` | the Recalls matching every query parameter given: `status` (`active`, `closed`), `category`, `class` (`I`, `II`, `III`, `unclassified`), `state` (USPS code; matches recalls that name the state and nationwide ones) |
| `GET /api/recalls/:id` | one Recall, or 404 |
| `GET /api/states` | an object keyed by USPS code, each `{ active, mostSevere }`: the active recalls by class, and the most severe class present (null when none). It counts only recalls that name the state. Nationwide recalls, which list every state, are counted under the key `nationwide` instead, in the same shape, so the map decides how to combine them |
| `GET /api/meta` | each source's `{ refreshedAt, count, error }` |

Before the first snapshot exists the routes answer as if it were empty. Routes are added to `apiRoutes` in `api.ts`.

### Refresh

`store.ts` keeps the snapshot in memory. On start it reads `data/snapshot.json` and refreshes at once if the file is missing or its `generatedAt` is `REFRESH_HOURS` (default 6) or more old; it then refreshes every `REFRESH_HOURS`. The server listens before the first refresh ends.

A refresh builds the next snapshot with the same `buildSnapshot` as `npm run ingest`, writes it to the file, and only then replaces the one in memory, so requests see either the old snapshot or the new, never a partial one. If the write fails, the old snapshot stays and the error is logged. A source that fails keeps its previous records inside the new snapshot, as [described below](#snapshot). Only one refresh runs at a time.

## Distribution patterns

`parseDistribution(text)` in `src/ingest/distribution.ts` returns `{ states, nationwide, foreign, unclear }`, with `states` as USPS codes in the order of `STATES`.

| Result | Set when |
|---|---|
| `states` | the text names a state, by full name in any case or by USPS code |
| `nationwide` | the text says nationwide, nationally, all 50 states, or worldwide/global; `states` then holds the 50 states and DC, plus any territory named |
| `foreign` | the text names a country other than the US, says OUS, outside the US, international or foreign, or is worldwide |
| `unclear` | `states` is empty, and the text is not nationwide and not foreign |

The reading is done in this order:

1. Denials are removed: "No foreign distribution", "OUS: None", "Foreign/VA/DOD: None". "DOD/VA" is dropped so it is not read as Virginia.
   US towns that share a country's name ("Holland, MI", "Lebanon, TN", "Panama City, FL") are dropped too, so they are not countries.
2. A foreign marker (`OUS`, `Foreign`, `International`, `outside the US`) sets `foreign` and hides the text after it up to the next `US:` or `Domestic:` label, so the codes in "OUS: IN, KR" are countries, not states.
3. Full names are matched longest first and blanked as they match, so "West Virginia" is not also Virginia, "New Mexico" is not also Mexico, and "Washington, DC" and "D.C." are DC, not Washington.
4. Two-letter codes match only in upper case and as whole words, so "in", "or", "me" and "ok" in prose are never states.
5. Countries are looked for in what is left.

Text in all capitals that uses "IN" or "OR" as words reads as the states Indiana and Oregon.

## Ingest

`npm run ingest` fetches each source in `SOURCES` (`src/ingest/sources.ts`, each `{ id, fetch, normalize }`), normalizes every record to a [Recall](glossary.md#recall), and writes the snapshot. `--fixtures` answers the openFDA requests from `test/fixtures/openfda/` and the fda.gov requests from `test/fixtures/announcements/` instead of the network.

openFDA serves food, drug and device enforcement reports at `https://api.fda.gov/<endpoint>/enforcement.json`. A request returns at most 1,000 reports and skips at most 25,000, so the fetcher reads one year of `report_date` at a time and halves a window whose total exceeds what skipping can reach. A 404 means an empty window; any other failed request fails the source. `OPENFDA_API_KEY`, when set, is sent as `api_key`; none is required.

### FDA announcements

A company announces a recall on fda.gov when it starts, often weeks before FDA classifies it and an enforcement report exists. The `fda-announcement` source reads FDA's recalls RSS feed (`https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml`), so such a recall is in the snapshot within hours of the announcement as an [unclassified](glossary.md#unclassified) one. The feed holds only recent announcements; history comes from the enforcement reports.

Each feed item becomes a Recall with `classification` null, `status` `active` and `id` `fda-announcement:` plus the announcement URL's path; its one link is the announcement. `reportedAt` is the feed's publish date. The item's page supplies the rest:

| Recall field | From the page |
|---|---|
| `category` | Product Type: Drugs is `drug`, Medical Devices `device`, anything else `food` (supplements, and types with no category of their own) |
| `product`, `reason`, `firm` | Product Description, Reason for Announcement, Company Name |
| `initiatedAt` | Company Announcement Date |
| `distributionText` | the announcement's sentences that mention distribution, shipping, sale or states; the states come from `parseDistribution` over that text, so the firm's own address is not read as a destination |

A page that fails to load or does not parse keeps its item: `product` and `reason` are the feed's title and description, `firm` is empty and `locationUnclear` is true. Only a feed that fails fails the source.

A refresh reads only pages not read before. `buildSnapshot` hands the source its records from the previous snapshot; the source keys them by link URL and reuses any whose page was read (its `firm` is not empty), whether or not the page named a distribution. A failed page is read again. fda.gov is asked for at most one request a second.

### Recall model

Defined in `src/shared/recall.ts`; the rest of the code never reads a source's own field names.

| Field | Holds | openFDA field |
|---|---|---|
| `id` | source and recall number, `openfda-food:F-0848-2024` | |
| `source` | `openfda-food`, `openfda-drug`, `openfda-device`, `fsis` or `fda-announcement` | the endpoint |
| `category` | `food`, `drug`, `device` or `meat-poultry-egg` | the endpoint |
| `recallNumber` | the agency's number | `recall_number` |
| `classification` | `I`, `II`, `III`, or null when not yet classified | `classification` ("Class I") |
| `status` | `active` for ongoing and pending, `closed` for completed and terminated | `status` |
| `product`, `reason`, `firm` | text | `product_description`, `reason_for_recall`, `recalling_firm` |
| `firmCity`, `firmState` | text, null when blank | `city`, `state` |
| `distributionText` | the [distribution pattern](glossary.md#distribution-pattern) as written | `distribution_pattern` |
| `states`, `nationwide`, `foreign`, `locationUnclear` | the parsed distribution | from `distributionText` |
| `quantity` | text, null when blank | `product_quantity` |
| `codeInfo` | both code fields joined, null when blank | `code_info`, `more_code_info` |
| `voluntary` | true when firm initiated, false when mandated, else null | `voluntary_mandated` |
| `initiatedAt`, `reportedAt`, `classifiedAt`, `closedAt` | ISO dates, null when absent | `recall_initiation_date`, `report_date`, `center_classification_date`, `termination_date` |
| `links` | `{ label, url }` list; one "openFDA record" link to `search=recall_number:"<number>"`, or for an announcement one "FDA announcement" link | |

### Snapshot

`data/snapshot.json`, ignored by git, is written to a temporary file and renamed, so a reader never sees a partial file.

```
{ generatedAt, sources: { [id]: { refreshedAt, count, error } }, recalls }
```

When a source fails, its records from the previous snapshot are kept as they were, `refreshedAt` stays at its last success (null if there was none), `count` is the number kept, and `error` holds the message. A failed fetch never leaves a source with fewer records. A source that succeeds replaces its records and has a null `error`. The run exits non-zero if any source failed.

## Build and run

- `npm run dev` runs Vite and the server under `tsx watch`; Vite proxies `/api` to the server's port.
- `npm run build` writes the web app to `dist/web` and compiles the server with `tsc -p tsconfig.server.json`.
- `npm start` runs the compiled server.

## Rules that hold across the code

| Rule | Kept by |
|---|---|
| The web UI reads data only through the API | no server code is imported by `src/web/`; shared code is types and constants |
| No test reaches the network | every source is tested against recorded responses in `test/fixtures/` |
| Every source normalizes to the Recall model, and nothing downstream reads a source's raw shape | `normalize` in each source; only `src/ingest/` knows openFDA's fields |
| Dependencies are pure JavaScript | the build image has no compilers |
