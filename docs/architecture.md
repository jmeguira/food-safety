[README](../README.md) · **architecture** · [product](product.md) · [glossary](glossary.md)

# Architecture

One Node process serves the [API](glossary.md#api) and the built web app; a React single-page app is the UI.

```
browser ── React app ── fetch /api ──▶ Hono server ──▶ (ingest, not yet built)
                 ▲                         │
                 └──── static files / shell┘
```

## Parts

| Part | Where | Responsibility |
|---|---|---|
| Server | `src/server/` | `createApp(webRoot)` in `app.ts` builds the Hono app; `main.ts` starts it on `PORT` (default 3000), serving `dist/web` |
| Web | `src/web/` | React app routed with react-router: `/` is the Map page, `/dashboard` the Dashboard; both are placeholders |
| Severity | `src/shared/severity.ts`, `src/web/severity.ts` | the [severity class](glossary.md#severity-class) type, and its label, color and meaning for display |
| Shared | `src/shared/` | types used by both server and web, such as `Health` |
| States | `src/shared/states.ts` | the 50 states, DC and the territories, each with USPS code, name and FIPS code; records carry USPS codes, the map joins on FIPS |
| Ingest | `src/ingest/` | `distribution.ts` turns a [distribution pattern](glossary.md#distribution-pattern) into states; reading [sources](glossary.md#source) is not built yet |
| Tests | `test/` | vitest; `test/fixtures/distribution.json` holds real distribution patterns from openFDA food, drug and device enforcement reports, each with its expected result |

## Server

`app.ts` handles requests in this order:

1. `GET /api/health` returns `{ "ok": true }`.
2. Any other `/api/*` returns 404 JSON, so an unknown API path never falls through to the [shell](glossary.md#shell).
3. Static files from the web root.
4. Any other path returns `index.html`, so client routes load directly.

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

## Build and run

- `npm run dev` runs Vite and the server under `tsx watch`; Vite proxies `/api` to the server's port.
- `npm run build` writes the web app to `dist/web` and compiles the server with `tsc -p tsconfig.server.json`.
- `npm start` runs the compiled server.

## Rules that hold across the code

| Rule | Kept by |
|---|---|
| The web UI reads data only through the API | no server code is imported by `src/web/`; shared code is types and constants |
| No test reaches the network | sources, once ingested, are tested against recorded responses in `test/fixtures/` |
| Dependencies are pure JavaScript | the build image has no compilers |
