[README](../README.md) · [architecture](architecture.md) · [product](product.md) · **glossary**

# Glossary

### recall
A public notice that a product is being pulled from the market. In this repository, one food, drug or device enforcement report from openFDA, held as a `Recall`. See [architecture](architecture.md#recall-model).

### class
The agency's grading of a recall, I, II or III, or null until it is classified. The Recall's `classification`; see [severity class](#severity-class).

### source
An agency feed that recalls are read from, registered in `src/ingest/sources.ts`. The three openFDA endpoints are the sources today. See [architecture](architecture.md#ingest).

### snapshot
`data/snapshot.json`: every source's recalls and each source's refresh time, count and error, written by `npm run ingest` and read by the server. See [architecture](architecture.md#snapshot).

### severity class
The agency's grading of a recall: Class I (serious harm or death is reasonably probable), Class II (temporary or reversible harm), Class III (not likely to cause harm), or unclassified when announced but not yet graded. Defined in `src/shared/severity.ts`; each class has a label, color and meaning in `src/web/severity.ts`.

### API
The HTTP routes under `/api` served by the server. The web UI reads data only through it. See [architecture](architecture.md#server).

### shell
The `index.html` page that loads the web app. The server returns it for any non-API path so client routes load directly.

### distribution pattern
The free text in a recall that says where the product went, such as "CA, NV, and AZ" or "Nationwide". It is read into states, nationwide, foreign and unclear by `parseDistribution`. See [architecture](architecture.md#distribution-patterns).

### nationwide
A distribution pattern that says the product went everywhere in the US ("nationwide", "nationally", "all 50 states") or worldwide. A nationwide recall reaches every state and DC.
