# Sprint 20F — Multi-brand Validation

## Scope

Validation brands:

- Toyota
- Jeep
- Volkswagen
- Audi

## Staging state at start

Toyota and Jeep:
- target enabled
- active Brand Connector exists

Volkswagen and Audi:
- target enabled
- origin MANUAL
- no active Brand Connector yet

Canonical MMV registry:
- catalog_mmvs rows = 0

Production remains untouched.

## Runner

Use:

```bash
pnpm agent:mmv-validation:20f
```

The runner is staged and governance-safe:

1. If a brand has an active connector, run MMV Discovery with OpenAI and persist operational findings.
2. If a brand has no active connector, run Brand Connector discovery and persist a proposal for human review.
3. Never activate a connector automatically.
4. Never ACCEPT a finding automatically.
5. Never apply a canonical MMV automatically.
6. Never mutate Production.

Reports are written to:

```text
.local-reports/agents/mmv-multibrand-validation/
```

Expected first-pass state:

- Toyota -> MMV_RUN_COMPLETED
- Jeep -> MMV_RUN_COMPLETED
- Volkswagen -> CONNECTOR_REVIEW_REQUIRED
- Audi -> CONNECTOR_REVIEW_REQUIRED

After operator review + connector activation for Volkswagen/Audi, rerun the same command. Then all four brands should execute MMV Discovery.

## Acceptance gates

For each brand validate:

- official evidence only;
- no external evidence leakage;
- current models/variants discovered;
- duplicate observations deduplicated;
- same-label/distinct-powertrain identities preserved;
- transmission-only descriptor drift does not create MMV;
- body derivatives surface as review-only when model identity is ambiguous;
- evidence readiness recorded;
- findings persist without canonical mutation.

Canonical Apply remains a separate operator action after ACCEPT.

## Production

No 20F data is copied from Staging to Production.
