# Sprint 27 — Ford Ranger XLS 3.0 V6 MY2027: matrix extraction test gate

## Operator validation confirmed on 2026-11-06
- The Ford XLS MY2027 identity matches the official individual version HTML.
- The XLS / Black / XLT / Limited technical matrix has been visually inspected.
- Example negative control: 12.4-inch digital panel is **OPTIONAL for Limited**, not an XLS standard equipment claim.
- QA product 1236 exists but has **zero technical values**, which must stay unchanged during source staging.

## Implemented in integration branch
- Pure validated source scope: `packages/core/src/agents/ford-ranger-xls-matrix.ts`.
- Multimodal PDF XLS column reader: `packages/adapter-openai/src/ford-ranger-xls-matrix-extraction.ts`.
- Stage-only paid run: `scripts/agents/ford-xls-matrix-staging-job.ts`, using dedicated Spec API key, usual USD 2 reservation, usage event and a review-only `agent_runs` summary, **no product or canonical writes**.
- QA worker dispatch input: `SPEC_INTELLIGENCE` with `xlsMatrixStageOnly: true`, `xlsMatrixProductId: 1236` and the QA supervisor flag.
- Tests require exact XLS column, legend, page, SHA-256; reject Limited optional 12.4-inch panel; abstain on missing legends.
- GitHub Actions check and adapter worker typecheck passed in run 42232534612 and 42232534589.

## Deployment and live-run status
- **Not yet deployed or executed**: the deployment connector returned a security block in this session. Do not claim an XLS matrix extraction run or new source findings.
- Last confirmed successful HTML audit run: e73b34fb-8ca6-401c-bb3c-ab115a14e375, `VERIFIED_FOR_REVIEW`.
- Prior XLS/XLT/Black/Limited vocabulary run is **not** a column-specific equipment application.

## Next QA run checkpoints
1. Deployment succeeds in QA only; inspect typecheck, startup and source SHA.
2. Verify budget remaining in `qa:BR:FORD:SPEC_INTELLIGENCE`; cap USD 2 for the pilot.
3. One job for product 1236, not the Ranger family and not all Ford MMVs.
4. Inspect `agent_runs.summary.claims` for the XLS-specific column, raw cell, legend, page, concept, unit/value, SHA and source.
5. Manually compare XLS 8-inch instrument cluster vs Limited optional 12.4-inch; any Limited-only claim is invalid.
6. Confirm XLS 10-inch multimedia is a distinct spec from instrument cluster.
7. Confirm no changes to `product_specs` or `agent_spec_selected_values`.
8. After QA signoff, fuse the staged PDF claims with HTML MY2027 source claims using `reconcileFordXls2027Sources`; output review proposals, never auto-apply.

## Current restriction
The staging job stores JSON source claims in its run summary. A future persistent source snapshot table and per-claim human approval flow should be completed before the first canonical product value is applied. Never turn a PDF catalogue date into model year.

## QA follow-up — 2026-11-06: actual printed matrix geometry

Inspected the original official Ford PDF page 2 visually. Printed columns are exactly:
`XLS 4x4 | Black | XLS 4WD | XLT 4WD | Limited`.

The 3.0 V6 Diesel/AT10 target is **the third printed column XLS 4WD**, not the first XLS 4x4. Ford uses `x` for present and dash for not available in the standard-equipment matrix. `Kit Opcional da versão Limited` is a separate section; it does not describe XLS equipment.

- Original extraction run `40da158e-03e9-491f-9196-a73bbd2bcdcc`: 30 claims, **REJECTED_LEGEND_UNVERIFIED**, estimated USD 0.01614375, usage reconciled.
- Second run `6b577da9-9fe1-4240-8edf-94cd97a70a48`: failed without persisted claims, estimated USD ~0.0045525, usage reconciled.
- Third run `26e11da5-2e39-4267-91b9-ff2e5c38602c`: five claims, **REJECTED_COLUMN_DRIFT**; incorrectly transcribed `x` in XLS for several absent items. Estimated USD 0.00524325, reconciled via PROVIDER_USAGE (cumulative Ford SPEC budget charged USD 0.08114725). No values applied.
- Implemented exact printed header and V6/AT10 binding; added a deterministic five-column row evidence requirement, known row reference checks, safety refusal on mismatched cells, and automatic per-run reconciliation for subsequent XLS jobs.
- At least the following original-PDF reference rows are used for alignment detection: `Ajuste elétrico da altura dos faróis`, `Bagageiro de teto`, `Degrau de acesso à caçamba`, `Estribo Plataforma`, `Faróis de neblina em Led`. The reference checks are limited to the exact Ford source, not generic brand-agnostic rules.
- Latest worker QA deployment `325d0713-9385-4808-824e-247241c51070` **SUCCESS** with five-cell evidence contract. CI integration and typechecks passed.
- A fourth execution request was blocked by platform tooling; **not queued**. Do not report any new extraction result. The product `1236` still has **zero** `product_specs`.

Next gate: obtain actual *full five-cell row arrays* from source PDF, ensure `rawCell === rowCells[2]` and golden anchors match, then run PDF + HTML fusion into review-only proposals. Do not apply equipment or numeric values automatically.
