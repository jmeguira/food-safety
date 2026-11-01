[README](../README.md) · [architecture](architecture.md) · **product** · [glossary](glossary.md)

# Product

## What it is for

Food [recalls](glossary.md#recall) are announced by the FDA and the USDA in separate places, in agency terms. This product brings them together so a reader can see:

- **Where** recalls are active, on a map of the United States.
- **How severe** each is, by its [severity class](glossary.md#severity-class).
- **Where to read the agency's own notice** for each.
- **How recalls have run over time**, on a dashboard of recall history.

## Who it is for

Anyone who wants to know what is being recalled near them, or how recalls have trended, without reading agency notices one by one.

## Where it stands

Done: the web shell with a Map page of states shaded by recall severity and a Dashboard page (a placeholder), a state's recall list and a recall's detail with links to its sources, the severity palette, and a server with a health check.

Not done: reading recalls from any [source](glossary.md#source), the dashboard charts. Those are what the product is for, not claims about the code.

## What it does not do

It does not replace the agencies: each recall is meant to link to the agency's own notice, which stays the authority.
