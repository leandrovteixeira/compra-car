# Sprint 20B — FIPE Source Boundary

## Decision

FIPE is a first-class independent Brazilian reference source for MMV evidence, but it is **not** a Brand Connector.

The official FIPE vehicle page states that:
- the year shown is model year;
- the public consultation is official through the FIPE channel;
- consultation is model-by-model;
- FIPE does not provide an API;
- FIPE does not provide complete or partial database downloads.

Therefore Sprint 20 must not implement a bulk FIPE crawler by reverse-engineering undocumented endpoints.

## Safe boundary

`FipeMmvLookupPort` is intentionally a **targeted lookup port**.

It can be used to:
- corroborate a manufacturer-discovered candidate;
- distinguish body/model variants such as Sedan vs Sportback when FIPE naming makes the distinction explicit;
- validate a suspected same-label/different-powertrain identity;
- create a FIPE-sourced proposal when a specific candidate is discovered through an allowed targeted lookup.

It must not expose `listAllBrands`, `listAllModels` or bulk-export semantics.

## Discovery consequence

Manufacturer Brand Connector remains the broad current-catalog discovery mechanism.

FIPE can still originate a proposal when a targeted FIPE consultation reveals an identity not yet present on the manufacturer site. What remains blocked is **mass enumeration of the FIPE database** without an authorized feed/source.

If an authorized FIPE dataset/API becomes available later, it can implement a separate bulk discovery port without changing the MMV domain contract.

## Provenance

Each FIPE observation preserves:
- official source URL;
- FIPE code;
- exact returned model label;
- model year;
- reference period;
- capture timestamp.

FIPE naming is evidence. It does not silently overwrite manufacturer commercial naming.
