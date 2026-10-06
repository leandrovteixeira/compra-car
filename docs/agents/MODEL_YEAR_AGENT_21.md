# Sprint 21 — Model Year Agent

## Goal

Complete the canonical flow:

`Brand → Model/MMV → Model Year → Price → Spec`

Sprint 21 never creates or silently rewrites an MMV. Identity belongs to Sprint 20.

## Operator UX

Findings must be human-first. The default surface should answer:

1. What was observed?
2. What does the agent recommend?
3. Why?
4. What action is expected from the operator?

Raw proposal/payload JSON is diagnostic detail only and should stay collapsed/hidden until requested.

## Canonical relation

`catalog_mmv_model_years` is the canonical bridge between an MMV and the concrete production/model-year pair used by `products`.

A single model year can legitimately coexist with the previous model year. Absence in one run is not discontinuation.

## Deterministic rules

- `MY2027`, `2027`, `linha 2027` normalize to model year 2027 when the source explicitly supports that reading.
- `2026/2027` means production year 2026, model year 2027.
- production year must equal model year or model year - 1 for the current Brazilian product model.
- a year without exactly one canonical MMV is not applied.
- zero MMV matches emits `POSSIBLE_NEW_MMV` and routes back to Sprint 20.
- more than one MMV match emits `PRODUCT_YEAR_CONFLICT`.
- a new MMV × PY/MY pair emits `NEW_PRODUCT_YEAR` and requires human review.
- a known pair may be emitted informationally as `CONFIRMED_MODEL_YEAR`.

## Apply semantics

Accepting a finding never mutates the catalog.

The separate apply action may:
1. upsert `catalog_mmv_model_years`;
2. create the corresponding `products` row as active + private;
3. attach `products.mmv_id`.

Price and Spec agents can then target the concrete product row.

## Cost guard

The model-year resolver is deterministic. LLM adjudication is reserved for conflicting or semantically ambiguous year evidence and must be recorded in the existing AI usage telemetry.
