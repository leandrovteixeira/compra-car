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
