# Sprint 27 — Isolated PBEV QA Source Staging (2026-11-05)

QA migration: `s27_qa_pbev_isolated_source_observations`.

## State

- Added isolated table `public.agent_pbev_source_observations`.
- RLS enabled, browser roles (anon, authenticated) denied, service_role read/write only.
- Table-level constraint disallows any canonical MMV/product IDs even if a client attempts to supply them.
- Version- and engine-scoped observations are kept separate from `product_specs` and the canonical specs dictionary.
- `source_sha256` is nullable **only** while `verification_status=PENDING_HASH`; the official PDF bytes could not be independently downloaded into this runtime for cryptographic verification, so rows remain non-eligible for application.

## Evidence

Official Inmetro PBEV 2026, 18th cycle, August 2026 edition; reference PDF is linked on official Inmetro PBEV page:
https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/

Official PDF at date of QA preflight (web page includes link for Tabela PBEV 2026_25_AGO.pdf, whose download resource has a historic filename):
https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/mascara-pbev-2026_19_jan-rev01.pdf/@@download/file

Page 8 (PDF page index 7) visually inspected.

| Table row | Fuel | Urban | Highway | Combined | Efficiency |
|---|---|---:|---:|---:|---:|
| Ford Nova Ranger 4x4, XLS, 3.0 V6 - 24V, A-10 | Diesel | 8.6 km/L | 10.1 km/L | 9.2 km/L | 2.93 MJ/km |
| Ford Nova Ranger 4x2, Black, 2.0 - 16V, A-6 | Diesel | 10.2 km/L | 12.1 km/L | 10.9 km/L | 2.45 MJ/km |

Both rows were staged in QA only, verification status `PENDING_HASH`; no canonical field values were applied.

## Matching rules (core)

`packages/core/src/agents/pbev-source-observations.ts` and its tests:
- source URL must be a trusted Inmetro path and tied to an immutable document hash
- require brand, model, version, engine, gearbox and fuel match
- prohibit implicit carryover to a different MY
- never map diesel km/L into existing gasoline/ethanol codes
- numeric MJ/km can be proposed for existing `OW_0001`, but only for review

## Next

Fetch source PDF bytes in the agent worker's approved networking environment, compute SHA-256, bind source rows to the hash and reread the page. Connect a read-only PBEV QA review run after that verification. Only canonical matching can request product-specific application; never direct-write `product_specs`.
