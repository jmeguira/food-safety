[README](README.md) · **AGENTS** · [architecture](docs/architecture.md) · [product](docs/product.md) · [glossary](docs/glossary.md)

# AGENTS

For whoever changes this repository. What the product is: [product](docs/product.md). How it works: [architecture](docs/architecture.md).

## How a change gets in

1. Make the change with the tests that establish it.
2. `npm test` and `npm run typecheck` pass.
3. Update the docs the change would leave false: [README](README.md), [architecture](docs/architecture.md), [product](docs/product.md), [glossary](docs/glossary.md).

## Invariants

- No test reaches the network.
- [Sources](docs/glossary.md#source) are tested against recorded responses in `test/fixtures/`.
- Dependencies are pure JavaScript: the build image has no compilers.
- The web UI reads data only through the [API](docs/glossary.md#api).
