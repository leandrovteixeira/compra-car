# Sprint 20E — Review / Apply Contract

## Objective

Separate three different events that must never be conflated:

1. **Discovery finding** — the agent observed something.
2. **Human review** — operator ACCEPT / REJECT / DEFER.
3. **Canonical apply** — an explicit, stale-safe action that changes canonical data.

An ACCEPT review is never itself a catalog mutation.

## Directly stageable reason classes

The following classes may become eligible for an explicit MMV apply action after ACCEPT:

- `NEW_MODEL`
- `NEW_COMMERCIAL_VARIANT`
- `SAME_LABEL_DISTINCT_POWERTRAIN`

The following remain review-only and cannot directly apply:

- `POSSIBLE_RENAME`
- `DESCRIPTOR_ONLY_VARIATION`
- `POSSIBLE_BODY_SPLIT`
- `POSSIBLE_SUCCESSOR`
- `POSSIBLE_DISCONTINUATION`
- `NON_MMV_PACKAGE`
- `AMBIGUOUS_IDENTITY`

## Staged proposal

Directly stageable findings now carry an explicit proposal:

```text
action = STAGE_MMV_IDENTITY
```

The proposal preserves:
- brand;
- model;
- body observation;
- official version label;
- trim;
- commercial powertrain;
- propulsion;
- engine displacement;
- resolved model variants for model-level findings.

This proposal is operational and reviewable. It is not a `products` row.

## Eligibility gates

`mmvApplyEligibility` requires all of the following:

- run status = COMPLETED;
- latest review = ACCEPT;
- finding type supported;
- reason code directly stageable;
- proposal present;
- caller-provided current fingerprint matches the accepted finding fingerprint.

Failure remains explicit:

- RUN_NOT_COMPLETED
- REVIEW_NOT_ACCEPTED
- MISSING_REASON_CODE
- REVIEW_ONLY_REASON
- MISSING_PROPOSAL
- STALE_PROPOSAL
- UNSUPPORTED_FINDING

This makes stale accepted findings unable to overwrite newer discovery state silently.

## Critical canonical boundary

The current canonical vehicle table is `products`.

A product requires:

```text
Brand + Model + Version + Production Year + Model Year
```

Sprint 20 owns only MMV identity.

Sprint 21 owns Product/Model Year.

Therefore **Sprint 20E must not create a `products` row from an MMV finding**.

Doing so would require either:
- inventing PY/MY;
- copying historical PY/MY;
- or allowing null/placeholder years.

All three violate the MMV/MY boundary.

The core therefore explicitly declares:

```text
MMV_PRODUCT_APPLY_BLOCKED_UNTIL_PRODUCT_YEAR = true
```

## Persistence decision required

Before implementing the write side of 20E, one canonical architecture decision remains.

### Option A — dedicated canonical MMV registry

Create a year-independent MMV registry before `products`.

Conceptually:

```text
catalog_mmvs
  id
  brand
  model
  official_version_label
  body_style
  commercial_variant_key
  powertrain_label
  propulsion
  engine_displacement
  status
  visibility
  source_finding_id
  created_at
  updated_at
```

Sprint 20 ACCEPT + explicit Apply can create an MMV registry row.

Sprint 21 then creates/links PY/MY product occurrences under that MMV.

Advantages:
- MMV Agent has a real canonical bank;
- Product Year Agent has the prerequisite catalog it needs;
- same visible label / different powertrain is representable;
- MMV lifecycle is independent from year lifecycle;
- no fake years.

Cost:
- new canonical table + migration;
- legacy `products` must eventually reference MMV identity.

### Option B — keep MMV only in Agent Platform until Sprint 21

ACCEPT remains an operational proposal.

No canonical MMV row exists yet.

Sprint 21 consumes accepted MMV findings and only then creates complete `products` rows with PY/MY.

Advantages:
- no new canonical table now;
- smaller immediate schema change.

Costs:
- MY Agent depends on operational findings instead of a canonical MMV bank;
- harder cross-run lifecycle/dedup;
- accepted MMV identity remains coupled to Agent Platform;
- same-label/different-powertrain canonical identity still has no stable home.

## Recommendation

Use **Option A — dedicated canonical MMV registry**.

It matches the dependency order already established:

```text
MMV Discovery -> canonical MMV bank -> Product Year Agent -> MMVY/products
```

and avoids forcing a year-aware legacy row to represent a year-independent identity.

## Current implementation status

Implemented:
- proposal generation;
- review/apply eligibility;
- stale fingerprint guard;
- direct vs review-only reason classes;
- explicit product-write block.

Not implemented pending architecture decision:
- canonical MMV storage migration;
- MMV repository;
- explicit Apply server action;
- Admin Apply button;
- linking `products` to canonical MMV.

No Production or Staging mutation has been performed.
