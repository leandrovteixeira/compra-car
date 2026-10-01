# Sprint 20C — MMV Identity Foundation

## Scope completed in this increment

Sprint 20C has started with the deterministic identity layer only.

The new `mmv-discovery-identity.ts` keeps the manufacturer's visible commercial version label unchanged while allowing an internal commercial-variant discriminator.

This is required for cases where the same visible version label is sold with distinct powertrains.

Example class:

- Jeep Commander / Overland / T270 MHEV
- Jeep Commander / Overland / 2.2T Diesel 4x4

Both can keep the visible label `Overland`, while the current-discovery identity key remains distinct.

## Identity-forming inputs in v1

The internal proposal key currently uses:

- brand;
- model;
- official version label (or trim only as fallback when official label is absent);
- commercial powertrain label, when explicitly published;
- propulsion;
- engine displacement.

The following are preserved in the discriminator/evidence but are **not identity-forming by default**:

- engine label;
- transmission;
- drivetrain.

This is intentionally conservative. It prevents technical wording such as `AT` vs `AT6`, or different engine-name wording, from silently creating a new MMV.

## Important boundary

This key is a discovery/proposal identity. It does not rewrite the legacy catalog and does not yet replace `CatalogMmvIdentity`.

Body-style resolution is still pending. `bodyStyle` remains null in this first deterministic foundation and will be added only with an explicit evidence path.

## Tests added

Coverage includes:

- same visible version + distinct powertrain => distinct internal identity;
- transmission-only variation => same identity;
- drivetrain-only variation => same identity at this stage;
- technical engine-label wording alone => same identity;
- special-edition/trim fallback when official version label is absent;
- unresolved model-only observation rejected from resolved identity projection.

## Next 20C increments

1. add explicit body-style observation to discovery candidates without breaking provider compatibility;
2. model/body resolver with review-required proposals;
3. descriptor-only vs new-commercial-variant reason classification;
4. connect current-discovery identity keys to reconciliation proposals;
5. benchmark Jeep/Audi-style ambiguity cases before any canonical apply behavior.
