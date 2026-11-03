# Watcher canonical bootstrap — QA 2026-10-27

Source: user-reviewed `Revisão de Marcas e Modelos Canônicos 20261027(1).xlsx` (357 products, 28 original labels, 73 distinct reviewed brand/model pairs).

## Applied

- Only Supabase Staging project `shfsjyjxmgwnlexmdkcs`.
- Inserted 27 missing ACTIVE `brand_identities` for market `BR` with `ON CONFLICT (market, canonical_key) DO NOTHING`; preserved existing Volkswagen identity with confirmed `VW` alias.
- Readback: 28 ACTIVE BR brand identities, one confirmed alias, 2 canonical MMVs and 357 products unchanged.
- No `products`, `catalog_mmvs`, candidate/review, publication, production, RSS or OpenAI writes.

## Remaining work / safeguards

- 73 reviewed brand/model pairs have **not** been persisted as canonical models. Existing `catalog_mmvs` stores brand/model/commercial VERSION and must not be populated with invented version labels. A separate model-level domain or an audited staging mapping is required before applying model/segment data to a canonical registry.
- 63 brand/model pairs have usable segment consensus. 10 pairs have an ambiguous `21` placeholder; never import `21` as segment, body style, propulsion, motivation, nor UUID. The source spreadsheet has `21` also in optional N-P columns; those values must be treated as unset, not trusted metadata.
- Keep the 357 product identities and provisional version strings unchanged until reconciled.
- Re-run the read-only intelligence preview and compare reports before and after brand bootstrap; do not claim discovery completeness because MMV registry still has 2 canonical versions.
- Production stays untouched.
