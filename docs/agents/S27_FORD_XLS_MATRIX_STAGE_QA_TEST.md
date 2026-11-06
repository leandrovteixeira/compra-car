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
