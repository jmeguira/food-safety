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
| Ingest | `src/ingest/` | reserved for reading [sources](glossary.md#source); empty |
| Tests | `test/` | vitest; `test/fixtures/` is empty, reserved for recorded source responses once ingestion exists |

## Server

`app.ts` handles requests in this order:

1. `GET /api/health` returns `{ "ok": true }`.
2. Any other `/api/*` returns 404 JSON, so an unknown API path never falls through to the [shell](glossary.md#shell).
3. Static files from the web root.
4. Any other path returns `index.html`, so client routes load directly.

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
