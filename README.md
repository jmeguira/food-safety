**README** · [architecture](docs/architecture.md) · [product](docs/product.md) · [glossary](docs/glossary.md)

# food-safety

A web app for seeing where FDA and USDA food [recalls](docs/glossary.md#recall) are active in the United States. It has a server with an API, a web shell with a Map page and a Dashboard page (the map shades each state by its most severe active recall begun in a chosen window, with filters, the nationwide recalls beside it and each source's freshness; choosing a state, or a list beside the map, lists its active recalls most severe first, and opening one shows everything the agency said with links to its notices), and the [severity](docs/glossary.md#severity-class) palette. Recalls are ingested from openFDA into a snapshot the server serves through `/api/recalls`, `/api/states` and `/api/meta`. See [product](docs/product.md) for what it is for.

## Requirements

Node 22 or newer and npm.

## Run

```sh
npm install
npm run dev        # Vite on :5173, API server on :3000
```

Open the address Vite prints. `/api` requests are proxied to the server; set `PORT` to move it.

## Build and serve

```sh
npm run build      # web to dist/web, server to dist/server
npm start          # serves the API and the built web on :3000
```

The server loads `data/snapshot.json`, and re-runs the ingest on start if it is missing or older than `REFRESH_HOURS` (default 6) and then every `REFRESH_HOURS`. See [architecture](docs/architecture.md#api) for the endpoints.

## Ingest

```sh
npm run ingest                # fetch every openFDA food, drug and device report into data/snapshot.json
npm run ingest -- --fixtures  # the same from the recorded responses, no network
```

`OPENFDA_API_KEY`, if set, raises openFDA's rate limits; none is required. See [architecture](docs/architecture.md#ingest).

## Check

```sh
npm test           # vitest, no network
npm run typecheck
```

## Docs

- [architecture](docs/architecture.md): the parts and how they fit
- [product](docs/product.md): what it is for
- [glossary](docs/glossary.md): the words the docs use
- [AGENTS](AGENTS.md): how a change gets in
