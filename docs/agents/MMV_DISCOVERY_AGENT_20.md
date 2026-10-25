# Sprint 20 — MMV Discovery Agent

## 20A — Contract & Current-State Audit

Date: 2026-10-01  
Branch: `sprint-20-mmv-discovery-agent`  
Base: `sprint-19c-brand-connector-agent`

## Objective

Evolve the validated Sprint 19A New Product Check prototype into the operational **MMV Discovery Agent**.

The agent answers:

> Which Brand + Model + Version commercial identities currently exist in the Brazilian 0-km market, based on auditable evidence?

It does **not** decide Product/Model Year, specifications, prices or publication.

## Canonical boundaries

- MMV Discovery owns **Brand + Model + Version / commercial variant identity**.
- Product Year Agent owns PY/MY observations and canonical MY creation.
- Spec Intelligence owns technical attributes after identity exists.
- Brand Connector owns manufacturer discovery targets and source topology.
- Human review remains authoritative while the agent is in validation mode.
- Acceptance of a finding does not silently mutate canonical catalog data unless an explicit apply contract exists.
- Historical identities are never deleted.

## Business rules frozen by Sprint 20 interview

### Identity

1. A meaningful commercial version name change after Brand + Model is a candidate new MMV.
   - Example: `Renegade Longitude T270` -> `Renegade Longitude T270 MHEV`.
   - Initially this is a proposal reviewed by the operator.
   - Later classes of decisions may graduate validation -> assisted -> auto after measured precision.

2. Packages/options never create MMV in the initial architecture.
   - Cosmetic packs, optional wheels, colors and equipment bundles remain non-identifying.

3. Named special editions create their own MMV.
   - Example: `Jeep / Renegade / Brightnight`.

4. Body derivative belongs to the product/model identity when it distinguishes the marketed product.
   - Example: `Audi A3 Sedan` and `Audi A3 Sportback`.
   - The manufacturer may omit the body from a nearby version label, so body resolution may use FIPE, URLs, structured documents and other evidence.
   - Body inference that changes model identity requires human review initially.

5. Facelift/new generation with the same commercial model name remains the same model.
   - MY captures temporal evolution.
   - Changed commercial versions create new MMVs.

6. Fuzzy similarity may generate a proposal, never an automatic merge.

7. Initial validation runs against current discovery reality first.
   - Legacy catalog reconciliation follows only after current discovery quality is understood.

8. FIPE is both corroboration and an independent discovery source.
   - A FIPE-only MMV may generate a new-MMV proposal before the manufacturer website exposes it.

9. Same model + same visible version name can still represent distinct commercial variants when powertrain differs.
   - Example class: identical trim label with different engine/powertrain offerings.
   - Therefore visible version label cannot be the sole canonical identity key.

10. Descriptor handling must distinguish non-identifying detail from real commercial identity.
    - Examples likely descriptive: `AT`, `AT6`, `Aut.`, `CVT` when merely technical detail.
    - Examples potentially identity-changing: `T270` -> `T270 MHEV`, gasoline/diesel/hybrid variants when they distinguish simultaneously offered commercial products.
    - The initial agent proposes; the operator validates ambiguous cases.

### Lifecycle

11. A missing source observation never deletes or immediately deactivates an MMV.

12. Missing-current-catalog monitoring accumulates consecutive absence observations.
    - After roughly **7–10 consecutive runs**, emit a discontinuation/deactivation alert for review.
    - Reappearance before threshold clears or reduces the absence state.
    - Historical records remain intact.

13. Likely successor relationships may be recorded as evidence/proposal metadata.
    - Example: old T270 variant replaced by a T270 MHEV variant.
    - Successor relation never merges identities by itself.

## Source model

### Manufacturer sources

Brand Connector remains the authoritative topology for manufacturer sources:
- allowed domains;
- source entries;
- search hints;
- terminology hints.

Typical evidence:
- technical sheet;
- version document;
- price list;
- configurator;
- model page;
- press release.

### FIPE

FIPE must not be treated as a manufacturer Brand Connector domain.

It is a separate Brazilian market reference source with its own acquisition/normalization adapter.

FIPE may:
- corroborate model/version/body/powertrain identity;
- resolve ambiguous manufacturer naming;
- independently discover an MMV;
- expose an MMV before a manufacturer current-catalog page.

A FIPE-only discovery is reviewable and may become a canonical MMV through the same explicit review/apply lifecycle.

### Secondary sources

Marketplace, dealer and press material may produce discovery leads or supporting evidence later, but they must not silently override manufacturer/FIPE identity.

Foreign-market sources are out of scope for Brazilian canonical identity.

## Current-state audit

### Reusable from Sprint 19A

Validated and reusable:
- provider contract and structured candidate extraction;
- official candidate validation;
- candidate deduplication;
- component normalization;
- conservative matcher;
- MMV-level reconciliation;
- report writer/CLI;
- Toyota and Jeep fixtures/benchmarks;
- evidence-preserving findings;
- explicit distinction between extraction confidence and novelty.

Historical implementation names such as `new-product-check-*` may remain temporarily; the canonical mission is MMV Discovery.

### Reusable from Sprint 19B

Reuse without redesign:
- `agent_runs`;
- `agent_findings`;
- `agent_evidence`;
- `agent_reviews`;
- Run -> Finding -> Evidence -> Human Review lifecycle;
- append-only reviews;
- operational persistence;
- replay/idempotency discipline;
- Admin review queue.

The generic platform must remain ignorant of MMV business identity.

### Reusable from Sprint 19C

Reuse:
- `brand_connector_targets`;
- versioned active `brand_connectors`;
- drift review/activation;
- stale-proposal guard;
- manufacturer source resolution;
- background research transport and diagnostics.

MMV Discovery should consume the active Brand Connector instead of maintaining brand-specific source registries in its own core.

## Mandatory gaps found in 20A

### GAP-20A-01 — canonical MMV identity is too narrow

Current `CatalogMmvIdentity` groups legacy rows by:

`brand + model + version label`

This is insufficient for the frozen Sprint 20 rule that two simultaneously sold products can share the same visible version label while having different powertrains.

Required direction:
- preserve the visible commercial label;
- add a stable internal commercial-variant discriminator;
- derive discriminator only from explicit structured evidence;
- never expose generated technical text as if it were an official version name;
- legacy matching may still project old rows conservatively.

Do not solve this by concatenating arbitrary engine/transmission strings into the official version label.

### GAP-20A-02 — source contract is manufacturer-only

Current `OfficialBrandSource` and official-domain validation assume manufacturer-owned sources.

Required direction:
- manufacturer discovery uses Brand Connector;
- FIPE is a separate first-class source adapter;
- candidates retain source authority/provenance;
- cross-source reconciliation happens after normalization.

### GAP-20A-03 — body derivative is not represented explicitly

Current candidate contract has model/version/powertrain but no body-style observation.

Required direction:
- add structured body observation where evidence exposes it;
- allow a model-resolution step to propose `A3` -> `A3 Sedan` / `A3 Sportback`;
- body inference that alters canonical model requires review until calibrated.

### GAP-20A-04 — current lifecycle does not track repeated absence

19A is a point-in-time comparison.

Required direction:
- derive cross-run observation state outside immutable findings;
- count consecutive misses for previously observed current MMVs;
- alert after configurable threshold defaulting within 7–10 runs;
- no automatic deletion;
- any deactivation is explicit and auditable.

### GAP-20A-05 — findings vocabulary is too coarse

Current relevant finding types are:
- `MMV_MATCHED`;
- `NEW_MODEL`;
- `NEW_VERSION`;
- `AMBIGUOUS_MMV`.

Sprint 20 needs to distinguish at least in domain payload/proposal:
- new model;
- new commercial variant;
- possible rename/descriptor-only variation;
- same visible label but distinct powertrain identity;
- possible body split;
- possible successor;
- possible discontinuation;
- non-MMV/package.

Whether every subtype becomes a database-level `finding_type` is an implementation detail; payload reason codes are preferred unless the Admin queue benefits from a top-level class.

## Proposed Sprint 20 pipeline

```text
Active Brand Connector
        |
        v
Manufacturer discovery -----------+
                                  |
FIPE discovery -------------------+--> normalized source observations
                                  |
                                  v
                         model/body resolution
                                  |
                                  v
                    commercial variant resolution
                                  |
                                  v
                         cross-source dedupe
                                  |
                                  v
                  current-discovery MMV snapshot
                                  |
                 +----------------+----------------+
                 |                                 |
                 v                                 v
          discovery QA                    legacy reconciliation
                                                    |
                                                    v
                                    findings / proposals / evidence
                                                    |
                                                    v
                                           human review / apply
```

## Identity contract direction

A candidate commercial variant should preserve these layers separately:

- `brand`
- `model` — canonical marketed product/model
- `bodyStyle` — evidence attribute, may participate in model resolution
- `officialVersionLabel` — exact published commercial label
- `trim` — structured trim observation
- `commercialPowertrainLabel` — explicit marketed powertrain discriminator
- `propulsion`
- `engineDisplacement`
- `engineLabel`
- `transmission`
- `drivetrain`
- evidence/provenance

The **officialVersionLabel remains presentation-authoritative**.
The internal identity may require a discriminator when the same visible label maps to distinct commercial variants.

## Automation maturity

Each decision class can independently evolve through:

1. `VALIDATION`
   - all identity-affecting proposals require operator review.

2. `ASSISTED`
   - high-confidence proposals are preclassified and batched; operator still applies.

3. `AUTO`
   - only explicitly approved decision classes/thresholds can auto-apply.
   - stale evidence and conflicting fresh evidence must block auto-apply.

No global "agent confidence" switch is allowed.

## 20A acceptance criteria

20A is complete when:
- current 19A/19B/19C assets are mapped to reuse/replace;
- business rules above are documented;
- gaps are explicit;
- Sprint 20 branch exists;
- implementation order is frozen without requiring schema mutation yet;
- no Production mutation occurred.

## Implementation order after 20A

### 20B — Discovery Engine
- consume active Brand Connector;
- add independent FIPE discovery boundary;
- normalize manufacturer + FIPE observations;
- retain source authority.

### 20C — MMV Identity & Matcher
- introduce internal commercial-variant discriminator;
- body/model resolver;
- descriptor-vs-identity classification;
- same-label/different-powertrain support;
- legacy reconciliation remains proposal-first.

### 20D — Evidence & Confidence
- source authority model;
- cross-source corroboration;
- reason codes;
- confidence policy per decision class.

### 20E — Review / Apply
- proposal schema;
- stale proposal protection;
- explicit canonical create/update/deactivate actions;
- no history deletion.

### 20F — Multi-brand Validation
Initial benchmark:
- Toyota;
- Jeep;
- Volkswagen;
- at least one brand with body ambiguity / same-label powertrain complexity (Audi is a strong candidate).

### 20G — Scheduled Operations
- recurring current-catalog runs;
- incremental source use;
- absence tracking;
- 7–10 run discontinuation alert threshold;
- observability/cost/runtime.

### 20H — Acceptance
- end-to-end current discovery;
- legacy reconciliation benchmark;
- measured precision/recall by decision class;
- decision on which classes, if any, may progress from VALIDATION to ASSISTED/AUTO.

## Explicit non-goals

- Product Year canonicalization.
- Specs canonicalization.
- Price intelligence.
- Foreign-market reconciliation.
- Package/option catalog.
- Automatic deletion.
- LLM-only canonical identity decisions.
- Inventing version names from technical attributes.
