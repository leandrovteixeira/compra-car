# Sprint 26 — Canonical Decision and Alias Contracts (DRAFT)

Status: **DRAFT / NOT APPROVED**. This document is a design contract, not an authorized database migration or enabled operator action. Source audited: Compra Car QA `shfsjyjxmgwnlexmdkcs`, 2026-10-28.

## 1. Delivery order / hard gates

1. Inventory current schemas/agent payloads and define domain contracts.
2. Agree on alias identity and persistence, with versions and rollback behavior.
3. Implement migrations and adapters **only in QA/Staging**, with zero production writes.
4. Prove transactions/idempotency/conflict handling using synthetic fixtures first.
5. Design Figma operator UX **against the approved contracts**.
6. Hook to actual QA findings with explicit operator authorization and test decision outcomes.
7. Production remains untouched until separately authorized promotion.

No migration, data mutation, auto-approval, alias backfill or spec ingestion is authorized by this draft.

## 2. Business semantics

Review states: `WAITING | APPROVED | REJECTED | POSTPONED` ONLY.

Public visibility/publishing status is orthogonal. APPROVED means the authorized canonical change **succeeded**. Never set APPROVED and then ask the operator to press Apply. No partial approval on mutation failure.

Common operator choices: `APPROVE | MERGE | REJECT | POSTPONE`.
`CREATE` is the contextual flow launched by APPROVE when the discovered object is not fully specified; an operator edits/completes the full canonical form and confirms once. It is not an additional review state.

Decision dispositions:
- APPROVE + `CREATE_CANONICAL` (or update an approved canonical configuration)
- MERGE + `LINK_CANONICAL` (+ alias, scoped)
- REJECT + `DISMISS`
- POSTPONE + `DEFER`

The visible button set is finding-specific. MMV resolved new identity: APPROVE/REJECT/POSTPONE (no MERGE). MMV ambiguous identity: APPROVE (create new), MERGE (select existing), REJECT, POSTPONE. Brand Connector source change: APPROVE/REJECT/POSTPONE. Model Year and Price with resolved target: APPROVE/REJECT/POSTPONE. Watcher brand candidate: APPROVE/MERGE/REJECT/POSTPONE; approval is not permission to invent an incomplete MMV.

### Finding contract

Each agent provides a **versioned candidate envelope** with:
- `sourceSystem, agentType, findingType, schemaVersion, producerRunId`
- `businessKey, market, observedIdentity, observedAttributes`
- `canonicalSubjectId?` and candidate target suggestions
- evidence references + capture times + evidence fingerprint
- immutable proposal snapshot + proposed effect + eligible action types
- prerequisites (identity, source trust, required fields, type/units)
- business/record version used for conflict validation.

A reading layer consolidates repeated run observations into ONE active case per business key and semantics, preserving source runs, provenance, evidence and historical decisions. Do not use run ID alone as the logical case identity.

### Decision contract

Server-only command: `caseId, findingSnapshotFingerprint, expectedCaseVersion, action, actorId, note, canonicalTargetId?, completedCanonicalInput?, idempotencyKey`.

Single DB transaction must:
1. authorize operator / action;
2. lock business identity + case; revalidate current finding, evidence, target and version;
3. reject ambiguous alias collisions, incompatible spec types/units/scales, stale proposals;
4. apply canonical insert/update/link and scoped alias;
5. append durable decision event and write terminal review status APPROVED/REJECTED/POSTPONED;
6. commit fully or roll back fully. Replays return the same receipt.

On failure, case remains WAITING (or prior status), with an operational error in logs/Flight Control, not a fake APPROVED.

Store action receipts with canonical target IDs and all changes; no hard delete of old evidence. Rejections must not create confirmed positive aliases. POSTPONED cases can be reconsidered on new material evidence.

The existing Agent Platform review and Watcher versioned review contracts must be bridged, not silently replaced. A shared UI status does not permit bypassing Watcher version fences or existing canonical RPC invariants.

## 3. Existing QA data model (read-only audit)

- `specs`: 321 rows, 170 binary, 59 numeric, 92 scale rows, 26 scale baselines.
- `specs.code` UNIQUE; `(group_name, equipment_group, spec_set, detail)` UNIQUE.
- `product_specs.equipment_id` references `specs.id`; `(product_id, equipment_id)` UNIQUE.
- `specs` defines English structural metadata, Portuguese labels, `type`, `unit`, numeric direction, valuation, display metadata and active flag.
- `brand_identities` and `brand_aliases` exist.
- `catalog_mmvs` exists; there is **no dedicated `mmv_aliases`**.
- There is **no dedicated spec alias dictionary**.
- `agent_reviews` stores ACCEPT/REJECT/DEFER and is append-only; Watcher uses a separate versioned intelligence review ledger.

Important: `scale` uses **one `specs` row per allowed option**, each with its own code and valuation; concept identity is currently structural `group_name + equipment_group + spec_set`. A scale family commonly has one baseline and multiple non-baseline choices. `spec_set` text alone is not globally unique.

## 4. Alias persistence contract

Do not introduce one polymorphic canonical ID field that points blindly to brands, MMVs and specs. Prefer domain-specific FK-safe tables with a shared resolution interface.

### `brand_aliases` — reuse and harden

Existing `brand_identity_id` target and market scope. A MERGE maps an observed name to a known brand without erasing whether a performance division/sub-brand requires a separate business relationship. Same normalized alias with competing canonical targets => operator conflict, not arbitrary overwrite.

### `mmv_aliases` — proposed new table

`id UUID`, `canonical_mmv_id UUID FK catalog_mmvs(id)`, `market`, `brand_identity_id` (if/when safely linked), `observed_brand/model/version`, `normalized_identity_key`, `powertrain_discriminator?`, `valid_from?`, `valid_to?`, `source_system`, `source_url?`, `source_finding_id?`, `decision_event_id`, `state (CONFIRMED|REVOKED)`, `created_at`, `revoked_at?`.

Matching is scoped by market + canonical brand + model + version and approved commercial discriminators, not globally by trim string. New Model Year is not silently part of MMV identity; any year-qualified alias must be constrained to the source/observation period.

Require a unique active alias key in its defined scope. An alias may not resolve to two active MMVs. Concurrent contradictory proposals are conflicts, not `last writer wins`. Previous mappings remain auditable after revocation/supersession.

### `spec_aliases` / `spec_option_aliases` — proposed

Two distinct mapping levels are required:

1. `SPEC_FIELD`: observed label of a spec -> existing canonical numeric/binary spec row or canonical **scale family**.
2. `SCALE_OPTION`: observed choice label -> existing `specs.id` option within a specific family.

A scale alias such as `air conditioning type` must not resolve directly to `dual zone` merely because that option is in the family.

A robust FK target for scale families requires a stable `spec_scale_families` table (or equivalent canonical family identity) joined to existing scale option rows; **do not mutate the existing 321 specs or codes as a shortcut**. Design that table and migration with compatibility/backfill tests before building Spec Agent persistence. Without an explicit family identity, a plain text tuple is insufficient as the sole long-term FK.

Minimal alias fields: normalized observed label, source/brand/market/locale context, target spec row or family/option, evidence fingerprint, decision event, status, effective window, created/revoked timestamps. A string match is a hint, not authority; type and unit compatibility must be checked.

Units and conversion aliases are separate from concept identity. Different units can refer to the same numeric spec only with an approved, reversible conversion. Neither a conflicting value nor a scale option is automatically merged as though it were a synonym.

### Resolver behavior

Exact canonical identity -> confirmed scoped alias -> deterministic validated cross-source mapping -> unresolved case.
Never global fuzzy autowrites. Matching against an alias does not suppress genuine evidence of a new commercially distinct product. New source evidence/version changes may reopen a previously rejected/postponed case.

## 5. Spec CREATE contract — full authoring, not just ACCEPT

A discovered candidate is NOT a completed spec definition.

On APPROVE-as-CREATE, the operator must supply/check the full canonical schema and see meaningful validation **before committing**:

- Identity and classification (English): `code`, `group_name`, `equipment_group`, `spec_set`, `detail`.
- Portuguese mapping: `group_name_pt`, `equipment_group_pt`, `spec_set_pt`, `detail_pt`, `display_pt`.
- Classification: `commercial_category`, `type=binary|numeric|scale`.
- Valuation: `unit_perceived_value` and `relative_value`, according to type and actual business meaning; do not assume one maps directly to the user's phrase "market value" without approval of pricing semantics.
- Presentation: `display_order`, `display_unit_pt`, `display_decimals (0..6)`, `display_multiplier`.
- Other canonical: `unit`, `value_direction=Positive|Negative|null`, `is_baseline`, `is_active`, `notes`.

Numeric:
- require canonical unit, direction (when economically comparable), display conversion/precision validated;
- unit_perceived_value may represent per-unit commercial valuation; zero is a real value.

Binary:
- presence/absence semantics only; no inferred `false` from missing evidence;
- commercial perceived value stored using current domain policy.

Scale:
- create a family + `N` explicit options (one persisted `specs` row/code per option);
- option English/Portuguese labels, commercial valuation and exactly one baseline for the full family;
- stable family identity; identical shared structural names/order for all options;
- prevent duplicate options and simultaneous incompatible option selection;
- create the entire family/options atomically (or add an option to an existing family under a separate versioned command).
- Example: `Air Conditioner / A/C Type` with `None, Manual, Full Auto, Dual Zone, Tri Zone, Quad Zone`.

The operator may edit suggested values but no field is silently inferred from a screenshot or loose text. Imported names become aliases **only if equivalence is explicitly validated**. After CREATE, original raw observation/evidence remains attached to the created canonical entity.

Spec CREATE must not attach an extracted observed value to a vehicle in the same command. Vehicle-to-spec assignments have their own review of model year/applicability, source and value.

## 6. Decision/action availability

| Finding condition | Allowed choices | Required completion |
| --- | --- | --- |
| New resolved MMV | APPROVE / REJECT / POSTPONE | Create MMV canonical only; no MY/price/specs/publication |
| Ambiguous MMV | APPROVE / MERGE / REJECT / POSTPONE | APPROVE validates complete new identity; MERGE selects compatible existing MMV and creates alias |
| Brand Connector source delta | APPROVE / REJECT / POSTPONE | Apply activated source map atomically; review-only warning does not create a queue action |
| New MY with canonical MMV resolved | APPROVE / REJECT / POSTPONE | Create MMV × MY, preserving PY uncertainty |
| Price finding with exact MMVY/reference period | APPROVE / REJECT / POSTPONE | Apply price history safely, no implicit public exposure |
| Watcher new brand (future) | APPROVE / MERGE / REJECT / POSTPONE | Create brand identity/target or link existing; does not create an MMV from news |
| New Spec | APPROVE-as-CREATE / MERGE / REJECT / POSTPONE | Full schema validation for CREATE or compatible selected canonical field/option for MERGE |
| Spec label ambiguity | APPROVE-as-CREATE / MERGE / REJECT / POSTPONE | Same; cannot equate conflicting values |

## 7. Hard acceptance gates before UX or ingestion

- One atomic decision leads to exactly one effective canonical mutation (or one alias binding) and one durable receipt.
- Approving a full new spec creates all mandatory metadata without placeholder or accidental default valuation.
- Scale creation handles a family and options correctly, including a single baseline and stable identity.
- MERGE records the scoped alias and its canonical target with source provenance.
- Re-executing unchanged agents does not requeue an already resolved case.
- Ambiguous aliases are never auto-applied and remain reversible/auditable.
- Current `specs`, `product_specs`, products, prices and Watcher remain unchanged during design.
- RLS/service-role-only write boundaries and server-side actor authorization are preserved.
- No Production work, no QA data backfill or operator actions before contracts/test gates sign-off.

## 8. Open design decisions for explicit review

- Persist canonical scale families in `spec_scale_families` (recommended) versus introducing a wider concept master; choose with migration compatibility evidence.
- Define economic semantics and validation for `unit_perceived_value`, `relative_value` and user-facing "valor de mercado".
- Decide whether Postponed cases have a revisit deadline or simply reopen on material new evidence.
- Confirm which roles may create new specs/change valuation versus just reconcile aliases.
- Define limited auto-application of already confirmed aliases (exact scope and snapshot; never uncertain match).
