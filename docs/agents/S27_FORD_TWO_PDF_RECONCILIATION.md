# S27 Ford Ranger — Two official PDF extraction pilot (QA, 2026-11-05)

Status: BOTH RUNS COMPLETED. Review-only; no product_specs writes or automatic canonicalization.

## Source runs

| Source | Scope | Run ID | Claims | SPEC_NEW | SPEC_AMBIGUOUS | AI estimated cost |
|---|---|---|---:|---:|---:|---:|
| Official XL PDF | XL CD/CS/CH MT/AT | 53804b4c-0b10-4904-acba-0d7054748da6 | 73 | 69 | 4 | USD 0.02363325 |
| Official XLS/Black/XLT/Limited PDF | Equipment matrix, 9/2026 catalog | f38d2b3a-fbbc-4fbe-96e4-94d4cb7b456b | 131 | 124 | 7 | USD 0.0315735 |
| Total raw | Separate official PDFs | | 204 | 193 | 11 | USD 0.05520675 |

- Cross-PDF equality by case-folded whitespace-normalized source label plus kind: 20 overlaps; 53 XL-only and 111 second-PDF-only, **184 distinct labels**. This count is NOT a count of new canonical specifications; semantic deduplication may reduce it.
- Evidence includes document SHA, manufacturer URL and page. No MY inferred from PDF path or date. Second PDF has catalog date 9/2026.
- Existing approved alias to numeric canonical CO_0017 for "Painel de instrumentos colorido de 8’’" retained; value 8 inch remains a candidate observation, not assigned to a specific product.
- Second PDF also includes "Painel de instrumentos colorido de 12,4\" configurável através de comandos no volante", which requires more work on mid-sentence value extraction and contextual attributes.
- First reservation eb106ad2-93cf-4a03-9fc7-90cae245a030 reconciled to estimated provider usage USD 0.02363325; second reservation 975ebe34-b3c0-472e-8426-3f9196e344e6 reconciled to estimated USD 0.0315735. Total allocated about USD 0.055207 under USD 2 cap. These are token-price estimates, not vendor invoices.

## Next gates
1. Run semantic candidate matching with context/unit validation before presenting all raw findings as truly new specs.
2. Ingest official Inmetro PBEV table by model/version/year/engine and fuel; preserve diesel versus gasoline/ethanol distinctions.
3. Visually verify XL/XLS/Black/XLT/Limited columns and optional equipment matrices, especially screen sizes, batteries, ADAS and towing.
4. Bind official MY2027 XLS version-specific source to product 1236. A 9/2026 catalog date alone is insufficient MY evidence.
5. Update Price Connector to official version pages and rerun deterministic Price.
6. Keep review-only, QA, no unattended scheduling, no Production promotion and Flight Control dashboards out of scope.

## PBEV official source preflight (read-only)

Inmetro 2026, 18th cycle, August 25 revision (official linked PDF, page index 7; visually verified after PDF retrieval):
https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/

- Official table includes 13 Ford Nova Ranger variants (Black 4x2 2.0, XL/XLS 2.0, LTD/XLS/XLT/LTD+ V6 3.0 and commercial XL/Cabine Simples/Chassis versions).
- Row **Nova Ranger 4x4 XLS 3.0 V6 - 24V**, combustion, A-10, diesel: city 8.6 km/L, highway 10.1 km/L, combined 9.2 km/L, energy 2.93 MJ/km. Classifications E within category and E overall.
- Row **Nova Ranger 4x2 Black 2.0 - 16V**, combustion, A-6, diesel: city 10.2 km/L, highway 12.1 km/L, combined 10.9 km/L, energy 2.45 MJ/km.
- Data are PBEV 2026 entries. PBEV participation is not confirmation of specific MY2027, and the XLS values are **not** written to product 1236.
- Existing canonical specs OW_0001 (MJ/km) and OW_0002/3 (gasoline urban/highway) do not by themselves represent diesel consumption. Require separate reviewed canonical diesel specs for urban/highway, unless an explicit compatible fuel-scoped schema is introduced.

Recommended PBEV implementation: source URL + document SHA + table page + source vehicle variant + fuel type + transmission + city/highway/combined and MJ/km; bind to canonical MMV/MY only with independently verified identity, else stage review. No automatic spec creation.
