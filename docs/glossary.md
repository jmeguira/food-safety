[README](../README.md) · [architecture](architecture.md) · [product](product.md) · **glossary**

# Glossary

### recall
A public notice that a food product is being pulled from the market. In this repository, one from the FDA or the USDA.

### source
An agency feed that recalls are read from. Reading from sources is not built yet.

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
