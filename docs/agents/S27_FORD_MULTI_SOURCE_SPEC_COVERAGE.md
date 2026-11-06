# S27 Ford Ranger — multi-source Spec Coverage (QA)

## Evidence and source priority
1. Ranger XL official Ford equipment matrix, 6 configurations:
   https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/nova-geracao-ranger/update-images/pdf/fbr-nova-ford-ranger-ficha-tecnica.pdf
   Brand Connector run c7e086d5-3c47-4bd5-8883-3243c98402ae.
   Vocabulary run 53804b4c-0b10-4904-acba-0d7054748da6: 73 labels, 69 new-candidate labels, 4 ambiguous, USD 0.023633. Source is **XL only** and is not MY-attested.
2. Ranger XLS, Black, XLT, Limited official Ford equipment matrix (includes separate Limited optional kit):
   https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/nova-geracao-ranger/pdf/fbr-ranger-ficha-tecnica.pdf
   Explicitly recorded as TECHNICAL_SHEET evidence in the MMV Discovery Ford run
   74ec6ae8-a6fe-43a5-bc52-83964c8fbcd7.
   This is a distinct source, not deduplicated as if it were the XL matrix.
3. Individual official Ford version pages, e.g. XLS 3.0 V6 Diesel 4WD AT 2027:
   https://www.ford.com.br/picapes/ranger/compare-as-versoes/xls-3-0-diesel-4wd-at/
   Use explicit MY and version bindings only; the official comparison page includes
   different model years and optional packages.
4. Official Inmetro PBEV 2026 18th cycle (August 25 update):
   https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular
   Reference fields: measured energy efficiency MJ/km, urban/highway fuel consumption
   by fuel (where provided), propulsion, engine/transmission, category efficiency
   classification and emissions. PBEV 2026 does **not** automatically prove MY2027
   equipment or current commercial availability. Model-version alignment needs review.

## Reconciliation policy
- Preserve each raw label verbatim with immutable document SHA-256, page, source URL,
  matrix column and (when supported) the exact quoted cell value.
- One canonical dictionary entry can have multiple manufacturer aliases; never
  create an additional canonical code just because the Ford label differs.
- Deduplicate vocabulary by (normalized label, kind, unit) **across documents**
  only after retaining per-source evidence and version columns. Same label may have
  different equipment availability and values by version.
- Keep status UNKNOWN for equipment not attested; a blank or missing cell is not
  proof of absence unless the document's legend explicitly makes that claim.
- No MY binding from PDF URL path, publication date or filename; require explicit
  manufacturer or vetted model-year document evidence.
- Split optional equipment packages from standard factory version specs.
- Numeric PBEV readings require a full variant and model-year match; otherwise
  stage for review without mutating product_specs.

## Review workflow
- Read original source label on every SPEC_NEW / SPEC_AMBIGUOUS row.
- Operator can approve a binary/numeric alias mapping to an active compatible
  canonical field, reject or defer. CREATE visible but disabled until full
  canonical dictionary maintenance screen is implemented.
- A review-approved alias is **not** an automatic assertion that the vehicle
  has the equipment. The product-specific observation/apply path is separate.
- Scale option families are not identical to scale field IDs: keep alias
  canonicalization disabled for scale until family mapping is implemented.

## Next quality gates
- Extract the second Ranger PDF via a source-verified, zero-auto-apply QA run.
- Compute source-by-source counts and deduplicated cross-source candidate counts.
- Add XLS 3.0 MY2027 product-specific extraction from verified official page/PDF.
- Ingest PBEV only via structured table reader + QA visual spot check.
- Visually inspect 10-20 high-impact rows: matrix columns for XL/XLS/Black/
  Limited, dimensions, powertrain, brakes, airbags, ADAS and PBEV energy use.
- Publish only after review and proven provenance. Keep Production untouched.
