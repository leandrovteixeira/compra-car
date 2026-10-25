# Sprint 20E — Review / Apply + Canonical MMV Registry

## Decision

Option A was approved: a dedicated, year-independent canonical MMV registry.

The dependency chain is now:

```text
MMV Discovery
  -> reviewed finding
  -> explicit Apply
  -> catalog_mmvs
  -> Product Year Agent
  -> products (MMVY)
```

`products` remains the year-aware occurrence table. `catalog_mmvs` owns identity independent of PY/MY.

## Why this reduces duplication

One commercial MMV is stored once in `catalog_mmvs`.

Multiple PY/MY occurrences may then reference the same `catalog_mmvs.id` through nullable `products.mmv_id`.

Legacy brand/model/version columns remain in `products` for compatibility during migration. They are **not removed or backfilled in Sprint 20E**. Therefore the immediate storage saving is secondary; the main gain is canonical identity, consistency and the ability to stop multiplying identity logic by model year.

A later migration may reduce duplicated legacy identity fields only after every consumer has moved to the MMV relationship.

## Staging migration

Applied only to **Compra Car Staging**:

```text
20261001184015_sprint_20e_canonical_mmv_registry
```

Production was inspected read-only and remains unchanged.

Immediately after migration:

```text
Staging catalog_mmvs rows = 0
Staging products with mmv_id != null = 0
Production catalog_mmvs = absent
Production products.mmv_id = absent
```

No QA/Staging data was copied to Production.

## Schema

`public.catalog_mmvs` contains:

- UUID primary key;
- market;
- deterministic identity key;
- brand;
- model;
- official version label;
- body style;
- commercial powertrain label;
- propulsion;
- engine displacement;
- ACTIVE / INACTIVE lifecycle state;
- PRIVATE / PUBLIC visibility;
- source finding;
- last confirmed finding;
- creator and timestamps.

Identity is unique by `market + identity_key`.

`products.mmv_id` is nullable and references `catalog_mmvs(id)` with `ON DELETE RESTRICT`.

No existing product is modified by the migration.

## Security

`catalog_mmvs` has RLS enabled.

Browser roles have no policies and no grants.

Only `service_role` has SELECT / INSERT / UPDATE.

The apply RPC is `SECURITY INVOKER`, not SECURITY DEFINER, and execute permission is granted only to `service_role`.

This follows the existing Agent Platform / Brand Connector server-only pattern.

## Review and Apply

Review remains append-only:

- ACCEPT
- REJECT
- DEFER

Review never mutates the catalog.

Directly stageable reason classes:

- NEW_MODEL, when at least one resolved variant exists;
- NEW_COMMERCIAL_VARIANT;
- SAME_LABEL_DISTINCT_POWERTRAIN.

Review-only classes remain non-applicable:

- POSSIBLE_RENAME;
- DESCRIPTOR_ONLY_VARIATION;
- POSSIBLE_BODY_SPLIT;
- POSSIBLE_SUCCESSOR;
- POSSIBLE_DISCONTINUATION;
- NON_MMV_PACKAGE;
- AMBIGUOUS_IDENTITY.

Applicable findings carry:

```text
action = STAGE_MMV_IDENTITIES
identities = [ ...1..50 deterministic MMV identities... ]
```

A NEW_MODEL finding can therefore stage multiple resolved MMVs atomically.

## Transactional RPC

`apply_catalog_mmvs` rechecks in the database:

- non-null server actor;
- COMPLETED MMV_DISCOVERY run;
- NEW_MODEL / NEW_VERSION finding;
- latest review = ACCEPT;
- exact accepted finding fingerprint;
- exact immutable proposal;
- allowed direct-apply reason code;
- proposal action and identities array shape;
- market consistency;
- identity field bounds;
- newer completed finding with the same subject does not exist.

The same advisory lock key used by review INSERTs is used by Apply, so a review cannot race the apply transaction.

The RPC is idempotent by `market + identity_key`.

Reapplying the same accepted finding returns the same canonical identity and only updates `last_confirmed_finding_id` / `updated_at`.

An identity-key collision with different canonical fields aborts the transaction.

## Staging validation

Executed with synthetic rows inside transactions followed by ROLLBACK:

1. Apply accepted MMV.
2. Reapply same accepted MMV.
3. Confirm only one canonical row exists.
4. Confirm PRIVATE / ACTIVE defaults.
5. Confirm stale accepted proposal is rejected when a newer completed MMV finding exists.

No synthetic smoke data remains.

## Agent / application integration

Core:
- CanonicalMmv;
- CanonicalMmvRepository;
- mmvApplyEligibility;
- canonical MMV bank reader contract.

Supabase adapter:
- listCanonicalMmvs;
- applyAcceptedProposal through `apply_catalog_mmvs`.

Admin:
- Apply is a separate server action from Review;
- button appears only for currently eligible ACCEPT findings;
- UI explicitly states that no Product/PY/MY is created;
- stale browser fingerprint blocks before RPC;
- database rechecks staleness again transactionally.

Sprint 21 can consume `listCanonicalMmvs({ market: 'BR', status: 'ACTIVE' })` instead of reading Agent Platform findings.

## Production integrity / promotion plan

Production must remain unchanged during Sprint 20 development.

A migration-history asymmetry was discovered during the read-only audit:

- Production records two migrations from 2026-09-29:
  - `20260929170822_promotion_backup_before_qa_baseline_20260929`
  - `20260929171848_sync_qa_direct_schema_and_security_20260929`
- Those migration files are not currently present in this Git branch.
- Staging does not record those two versions.

Therefore **do not run an automatic migration push to Production yet**.

Before Production promotion:

1. reconcile Production migration history with the repository using a schema/migration audit;
2. confirm the two 2026-09-29 Production-only history entries are understood and preserved;
3. verify the Production schema required by 20E matches the expected pre-migration state;
4. take the standard Production backup/checkpoint;
5. apply exactly `20261001184015_sprint_20e_canonical_mmv_registry.sql`;
6. verify `catalog_mmvs` is empty and all existing `products.mmv_id` values are null;
7. run Supabase security/performance advisors;
8. only then deploy code that can use the new registry;
9. never copy Staging MMV rows to Production;
10. populate Production MMVs only through fresh Production discovery/review/apply or an explicitly authorized Production import.

Backfill of legacy products to MMV IDs is a separate later operation and must be independently validated before Production execution.

## Advisor result

Staging advisors were run after migration.

The new table follows the intentional server-only pattern: RLS enabled, no browser policies/grants.

The advisor reports `RLS enabled no policy` as INFO for this and many existing server-only tables. This is expected under the deliberate no-browser-access model.

New indexes are reported as unused immediately after creation, which is expected before production traffic.

No Sprint 20E-specific destructive or browser-exposure issue was identified.

## Next

20F — multi-brand validation should populate the new MMV registry only through explicit accepted findings in Staging.

Recommended benchmark set remains:

- Toyota;
- Jeep;
- Volkswagen;
- Audi or another body-derivative-heavy brand.

Production remains untouched until the full Sprint 20 acceptance gate and migration-history reconciliation are complete.
