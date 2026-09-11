# Sprint 17 — Seller MVP Completion

Status: COMPLETE

Date: 2026-09-11

## Scope delivered

The Seller area is read-only for MVP and exposes only two product-facing capabilities:

- Ver Modelo
- Comparar Modelos

The Seller shell uses a desktop sidebar for product navigation and a unified topbar menu for profile/account actions. On mobile, navigation and account actions collapse into the same menu. Menus close on navigation, outside click, and Escape.

## Ver Modelo

The page provides:

- vehicle search;
- current MSRP;
- comparison radius of ±3%, ±5%, or ±10%;
- count of comparable models in the selected radius;
- overall score;
- radar chart;
- ten category scores.

The desktop layout is intentionally compact and designed to fit the working viewport without vertical scrolling in common desktop resolutions.

## Score Engine v1

Monetary categories continue to use perceived value relative to the best vehicle inside the selected current-MSRP radius.

`Espaço + Carga` is a special nominal category based on physical dimensions instead of perceived monetary value.

`Ownership` is also treated as a special cross-powertrain category for the MVP. Its current implementation is provisional and normalizes nominally comparable dimensions such as equivalent stored energy, equivalent range, warranty, FE, and consumption. Charger AC/DC and V2L are intentionally excluded from the cross-powertrain score because there is no defensible ICE equivalent yet.

The Ownership model is not considered final product intelligence. A later operational/intelligence sprint should replace the provisional equivalences with a governed cross-powertrain model.

## Seller product eligibility hardening

The Seller experience does not currently trust operational lifecycle flags alone to determine the commercially current product.

For each normalized `brand + model + version` identity, Seller eligibility uses:

1. highest `model year`;
2. inside that model year, highest `production year`.

This rule applies both to the Seller comparison catalog and to the Ver Modelo score universe. It hides superseded PY/MY combinations without deleting or mutating historical Products.

This is an MVP hardening rule, not the final Product lifecycle workflow.

### Staging audit at closure

After applying the rule to active Products with a current public price:

- 179 Seller rows;
- 179 unique brand/model/version identities;
- 0 duplicate Seller identities;
- current-price range: R$ 99,290 to R$ 329,990.

The eligibility rule is centralized in `seller-product-eligibility.ts` and covered by regression tests for latest MY, latest PY within MY, normalized identity matching, DTO year strings, and database numeric year fields.

## Deferred by design

The following are explicitly outside Sprint 17 and belong to future operational/AI-agent work:

- Product lifecycle automation;
- new MY/PY detection;
- automatic supersession/deactivation;
- operational review queues;
- catalogue inconsistency alerts;
- AI-assisted product and price monitoring;
- final Ownership Intelligence;
- seller write/upload capabilities.

Sprint 17 closes the read-only Seller MVP without attempting to solve those operational workflows prematurely.
