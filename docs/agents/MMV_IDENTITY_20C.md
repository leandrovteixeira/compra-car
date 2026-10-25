# Sprint 20C — MMV Identity & Body Intelligence

## Status

Implemented on branch `sprint-20-mmv-discovery-agent`, pending local gates.

## Commercial identity

The current-discovery identity keeps the manufacturer's visible version label unchanged while allowing an internal commercial-variant discriminator.

This supports cases such as:

- Jeep Commander / Overland / T270 MHEV
- Jeep Commander / Overland / 2.2T Diesel 4x4

Both can retain the visible label `Overland`, while explicit commercial powertrain evidence keeps the identities distinct internally.

Identity-forming inputs in v1:

- brand;
- model;
- body style when explicitly observed;
- official version label (or trim only as fallback);
- commercial powertrain label when explicitly published;
- propulsion;
- engine displacement.

Preserved as evidence but non-identifying by default:

- engine label;
- transmission;
- drivetrain.

This prevents technical wording such as `AT` vs `AT6` from silently creating a new MMV.

## Body intelligence

Product research schema v3 adds nullable `bodyStyle`.

The provider must:
- extract body only when explicitly supported;
- keep `model` unchanged;
- never synthesize `A3 Sedan` from `model=A3` inside the LLM.

Core then produces a review-only `POSSIBLE_BODY_SPLIT` proposal when body is explicit but absent from the model name.

Example:

```text
observed model: A3
bodyStyle: Sedan
proposal: A3 Sedan
requiresReview: true
```

No canonical model rename happens in discovery.

Current snapshot schema is now `20C.1` and includes `bodyModelProposals`.

## Version-change reason classification

`classifyMmvVersionChange` produces proposal reasons, never canonical decisions.

Initial deterministic classes:

- `SAME_LABEL_DISTINCT_POWERTRAIN`
  - same visible version label;
  - explicit powertrain identity differs.

- `NEW_COMMERCIAL_VARIANT`
  - explicit commercial powertrain identity changes.
  - Example class: `Longitude T270` -> `Longitude T270 MHEV`.

- `DESCRIPTOR_ONLY_VARIATION`
  - visible difference is transmission-style technical wording only;
  - no distinct explicit commercial powertrain identity.
  - Example class: `T270 AT` vs `T270 AT6`.

- `POSSIBLE_RENAME`
  - name changed, but structured evidence does not prove a distinct commercial variant.

Every class remains review-required in this Sprint.

## Provider contract

OpenAI product research structured output is now `official_product_candidates_v3`.

`bodyStyle` is a strict nullable output field in the real provider schema. Historical core fixtures may omit it; core normalizes absence to null for replay compatibility.

## Boundaries

- No legacy catalog rewrite.
- No canonical create/update.
- No migration.
- No automatic merge.
- No automatic body split.
- No Product Year decision.
- No package/option identity.
- FIPE remains a separate targeted evidence boundary.

## Tests

Coverage now includes:
- same visible label + distinct powertrain;
- T270 -> T270 MHEV;
- AT vs AT6 descriptor-only variation;
- possible rename fallback;
- A3 + Sedan review-only proposal;
- no body proposal if body is already present;
- strict provider bodyStyle output;
- body-aware discovery identity;
- historical fixtures with missing bodyStyle normalized to null.

## Next

After local gates:
1. persist reason codes in MMV operational finding payloads;
2. expose body proposals/reason codes in Admin review;
3. connect accepted proposals to explicit apply contracts;
4. benchmark real Jeep plus a body-ambiguous brand before considering ASSISTED behavior.
