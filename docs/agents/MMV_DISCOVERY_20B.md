# Sprint 20B — Current MMV Discovery Engine

## Status

Implemented on branch `sprint-20-mmv-discovery-agent`.

## Purpose

Separate **current-market discovery** from **legacy catalog reconciliation**.

Before 20B, `NewProductCheckAgent` performed these concerns in one flow:
1. research current official sources;
2. validate/deduplicate candidates;
3. read the legacy catalog;
4. reconcile discoveries against legacy MMVs;
5. produce findings.

After 20B, the flow is layered.

## Layer 1 — CurrentMmvDiscoveryAgent

`CurrentMmvDiscoveryAgent`:
- resolves the active Brand Connector;
- runs provider research;
- validates candidate schema;
- enforces manufacturer source allowlists;
- strips provider-only fields;
- rejects out-of-scope/external evidence;
- deduplicates current observations;
- produces a `CurrentMmvDiscoverySnapshot`.

It has **no catalog dependency**.

Snapshot schema: `20B.1`.

The snapshot includes:
- discovered brand/market;
- researched/accepted counts;
- model/variant counts;
- deduplicated current candidates;
- rejected candidate diagnostics;
- rejected external-source count;
- provider metadata.

It deliberately excludes:
- legacy product IDs;
- known MMV counts;
- match modes;
- NEW_MODEL/NEW_VERSION conclusions;
- canonical mutations.

## Layer 2 — Legacy reconciliation

`NewProductCheckAgent` remains the compatibility reconciler.

It now:
1. obtains a current snapshot from `CurrentMmvDiscoveryAgent`;
2. reads the administrative legacy catalog;
3. projects legacy MMV identities;
4. reconciles the snapshot candidates through the existing conservative matcher;
5. preserves the historical `19A.4` reconciliation result contract.

This means discovery can be benchmarked independently without changing existing consumers.

## CLI

Pure current discovery:

```powershell
pnpm agent:mmv-discovery:dry-run -- --brand Toyota --provider fixture
pnpm agent:mmv-discovery:dry-run -- --brand Jeep --provider openai
```

Equivalent low-level invocation:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture --discovery-only
```

Reports:
`.local-reports/agents/mmv-current-discovery/<run-id>.{json,md}`

The discovery-only mode:
- does not read the legacy catalog;
- does not create reconciliation findings;
- cannot be combined with `--persist-findings`;
- does not mutate canonical data.

Existing reconciliation mode remains unchanged:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
```

## FIPE

20B also defines the separate targeted `FipeMmvLookupPort` in
[FIPESOURCE](FIPE_SOURCE_20B.md).

FIPE evidence is intentionally not mixed into the manufacturer Brand Connector allowlist.

## Acceptance criteria

- current discovery executes without a catalog reader;
- current snapshot remains free of legacy reconciliation fields;
- existing reconciliation consumes the current snapshot;
- existing matching semantics remain unchanged;
- pure-discovery CLI cannot persist reconciliation findings;
- no migration or Production mutation is required.

## Next

20C owns:
- commercial-variant identity discriminator;
- same-visible-label/different-powertrain handling;
- body/model resolution;
- descriptor-only vs new-MMV classification;
- proposal reason codes for the new identity model.
