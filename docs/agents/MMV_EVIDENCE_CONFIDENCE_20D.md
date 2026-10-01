# Sprint 20D — Evidence & Confidence

## Objective

Make MMV findings explain not only **what** changed, but also **how strong the supporting evidence is**, without converting evidence quality into automatic catalog mutation.

## Source authority

Sprint 20D distinguishes source semantics:

- `MANUFACTURER` → `PRIMARY_COMMERCIAL`
  - current commercial naming, configurator, technical sheet, version documents and current product pages.

- `FIPE` → `PRIMARY_MARKET_REFERENCE`
  - Brazilian market reference/corroboration with different semantics from manufacturer pages.

- `SECONDARY` → `LEAD_ONLY`
  - may support discovery leads later, but cannot independently produce high readiness.

Manufacturer and FIPE are both strong primary sources, but they are **not interchangeable**.

## Corroboration levels

- `NO_EVIDENCE`
- `SECONDARY_ONLY`
- `SINGLE_PRIMARY`
- `MULTI_SOURCE_SAME_KIND`
- `CROSS_PRIMARY`

`CROSS_PRIMARY` means at least one manufacturer source plus FIPE evidence.

Multiple manufacturer documents improve breadth but are still same-kind corroboration.

## Readiness

Readiness is one of:

- `LOW`
- `MEDIUM`
- `HIGH`

It is **not**:
- probability of truth;
- probability of novelty;
- model confidence;
- permission to mutate the catalog.

Extraction confidence remains the provider's confidence in extracting a fact.

Evidence readiness combines:
- extraction confidence;
- source diversity;
- source authority;
- blocking warnings;
- decision class.

## Conservative policy

Blocking warnings:
- `CONFLICTING_SOURCES`
- `INSUFFICIENT_EVIDENCE`

always cap readiness at `LOW`.

High-risk reason classes cannot reach `HIGH` in this Sprint even with manufacturer + FIPE corroboration:

- `POSSIBLE_RENAME`
- `POSSIBLE_BODY_SPLIT`
- `POSSIBLE_SUCCESSOR`
- `POSSIBLE_DISCONTINUATION`
- `AMBIGUOUS_IDENTITY`

## Automation boundary

Every Sprint 20D assessment returns:

```text
maturity = VALIDATION
automationEligible = false
```

This is intentional.

A finding may be `HIGH` readiness and still require operator validation.

Transition to `ASSISTED` or `AUTO` must happen later, per decision class, after measured precision and an explicit policy change.

## Provenance

Internal `ProductEvidence` now supports `sourceKind`.

Provider output does not control this field.

Manufacturer research is projected internally as:

```text
sourceKind = MANUFACTURER
```

FIPE adapters can later emit:

```text
sourceKind = FIPE
```

Evidence fingerprints now include source kind (`mmv-evidence:v2`) so provenance changes cannot collide.

## Agent Platform

Reviewable findings persist an `evidenceAssessment` in existing finding payload JSONB.

No migration is required.

Example:

```json
{
  "reasonCode": "NEW_COMMERCIAL_VARIANT",
  "evidenceAssessment": {
    "corroborationLevel": "CROSS_PRIMARY",
    "readiness": "HIGH",
    "maturity": "VALIDATION",
    "automationEligible": false
  }
}
```

Admin displays:
- reason code;
- readiness;
- corroboration level;
- explicit "validação humana" status.

## Schema version

MMV reconciliation output is now `20D.1`.

Current discovery snapshot remains separately versioned.

## Non-goals

- no automatic apply;
- no threshold promotion to ASSISTED/AUTO;
- no FIPE bulk crawling;
- no source score used as truth probability;
- no catalog mutation;
- no schema migration.

## Next

20E may use these evidence assessments to control **which explicit apply actions are even eligible to be offered**, while human review remains mandatory until calibrated.
