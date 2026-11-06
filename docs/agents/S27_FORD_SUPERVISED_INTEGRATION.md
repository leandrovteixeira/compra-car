# Sprint 27 — Supervised Ford end-to-end integration

Status: IN PROGRESS. QA ONLY. Not deployed, no automated run authorized by this file.

## Objective
Reconcile Sprint 27 Spec Agent with the Generation classifier/vision adapter without touching the current QA worker or Production. Then run one supervised Ford vehicle from Brand Connector through MMV, FIPE/MY, generation evidence/classification, Spec and Price, with per-stage operator inspection. Flight Control dashboards and UX are out of scope.

## Branches
- Integration baseline: `sprint-27-spec-agent`.
- Existing deployed worker base: `sprint-26-agent-ux-control-center` (ancestor of the baseline).
- Selective sources: `sprint-26-generation-ai-adapter`.
- Do not merge the entire generation branch: it includes unrelated web/worker changes.

## Stage gates
1. Resolve shared exports and compilation, retain all S27 spec modules and S26 worker handlers.
2. Implement Generation Evidence Collector: official pre/post MY documents and comparable official images, with immutable source/hash/MY bindings. If official comparable images are unavailable, report UNKNOWN; never fabricate MY binding.
3. Connect generation assessment to job execution and review queue. Keep generation review-only, no MMV or spec canonical writes.
4. Wire SPEC_INTELLIGENCE into agent-job-worker with idempotent job processing, dedicated key, USD 2 admission, usage ledger, and review candidate persistence. Never auto-create canonical spec codes.
5. Review the Ford Ranger source and exact MY/version against the QA canonical MMV. Freeze source snapshot for the pilot.
6. Supervised run order: BRAND_CONNECTOR → MMV_DISCOVERY → FIPE_DISCOVERY → PRODUCT_YEAR only if eligible → EVIDENCE_COLLECTION → GENERATION_CLASSIFICATION → SPEC_INTELLIGENCE → PRICE. Price does not depend on spec approval.
7. After each stage verify status, source provenance, job/run IDs, tokens, cost, findings, no unauthorized catalog writes. Pause on ambiguity. No unattended brand-wide scheduling.
8. Tests: TypeScript typecheck, targeted core and adapter tests, agent worker dispatch tests, run smoke, QA readback and review-case integrity before enabling the pilot.

## Out of scope
Flight Control dashboard, visual controls, production promotion, broad semi-autonomous scheduling, mass canonicalization.

## Present blockers
- Evidence Collector not yet implemented.
- Generation adapter modules are staged selectively but the worker dispatch path is not yet integrated.
- Spec-agent runs have been isolated pilots; integration with the live worker and review queue requires validation.
- No full supervised Ford run has occurred.

## Integration progress — 2026-11-05
- Created integration branch from S27, preserving original QA worker branch.
- Ported generation Core classifier/evidence/review, OpenAI Vision and assessment adapter, tests, QA-only pilot and GWM fixture from S26 generation branch; updated shared exports without replacing S27 modules.
- Added deterministic `generation-evidence-collector.ts` and eight targeted tests. It selects verified image pairs handed over by trusted source adapters. It DOES NOT yet fetch official website images or parse PDF image assets.
- Added dedicated CI `s27-supervised-integration.yml` with targeted tests and package typechecks. GitHub combined status has not yet reported a result; CI is not claimed green.
- No change to the live Railway agent-worker, no DB changes, and no Ford job has been dispatched.

### Implementation blockers before the Ford run
1. Brand Connector image/PDF adapter must produce immutable asset records with verified historical MY and view metadata. Historical image bytes should be captured in a trusted persistent store and fetched for Vision only when verified.
2. Implement and test the Generation Assessment repository against those records; integrate into worker/job dispatch behind supervised QA gate.
3. Implement production-quality Spec Agent runner for an arbitrary Ford MMV and source (current GWM one-shot is fixture-specific), including cost receipts and durable `SPEC_NEW`/`SPEC_AMBIGUOUS` review cases.
4. Add safe supervised orchestration and targeted queue tests; do not reuse the ordinary autonomous schedule or assume the current database job enum accepts new types.
5. Require green checks and live QA identity verification before changing any Railway deployment.

## 2026-11-05 — Supervised Spec integration and QA preflight

- Added `spec-agent-supervised-candidates.ts` and its unit tests for approved alias, ambiguous exact labels, genuine new candidates, units and stable document fingerprints. This is source-claim reconciliation, not raw PDF parsing.
- Added `scripts/agents/spec-supervised-worker.ts` and a QA-flagged `SPEC_INTELLIGENCE` worker branch. The runner reads the current `specs` and confirmed `spec_field_aliases` from QA and persists review-only `UNMATCHED_SPEC` findings with reason `SPEC_NEW` or `SPEC_AMBIGUOUS`; the Review projection differentiates them. No canonical spec writes.
- The runner requires `QA_SUPERVISED_SPEC_ENABLED=1`, Ford BR, an operator-attested official source hash, a specific source MY and version, and an existing QA product linked to a canonical MMV. It cannot consume an arbitrary unverified vehicle identifier.
- QA read-only baseline: 321 canonical specs (170 binary, 59 numeric, 92 scale); zero saved `spec_field_aliases` rows. The only Ford product found was Territory MY2026 product 1007, without a canonical `mmv_id`. There was **no Ranger product or Ford canonical MMV** at the time of preflight.
- QA migration `s27_qa_supervised_spec_job_type` succeeded, and readback confirmed `SPEC_INTELLIGENCE` added to the `agent_jobs_job_type_check` allowlist. Existing jobs remain unchanged; no job was enqueued.
- Draft PR #28 opened against Sprint 27. Initial CI exposed missing Generation provider bindings; ported the missing `NewProductCheckAgent`, result and review mapper contracts while preserving S27 behavior. Latest completed Sprint 27 Spec Agent checks after that reconciliation: PASS.
- No Railway worker deployment, Ford run, OpenAI inference, or spec approvals occurred as part of this step.

## Remaining run blockers
1. Ford Ranger must pass actual Brand Connector/MMV review and be tied to an approved canonical product and explicitly verified MY. Do not create fake product rows.
2. A real Ford manufacturer technical source must be retrieved and its version-specific claims extracted automatically (current GWM pilot is specialized). The new generic runner accepts verified claims; it is NOT itself an automatic PDF extractor.
3. Collector must capture and bind historical official design image pairs for previous/current MY; Generation Vision is prepared but not yet wired end to end.
4. Verify the full queue/review flow with targeted tests on QA worker integration, then separately deploy the integrated worker while leaving `QA_SUPERVISED_SPEC_ENABLED` disabled until the supervised run.
5. Execute Brand → MMV → FIPE/MY → Generation → Spec → Price with recorded checkpoints; stop if upstream identity is ambiguous.

## 2026-11-05 — Ford Ranger MMV source coverage follow-up

- Operator approved 8 Ranger XL/XLS MMVs and Ranger Raptor in QA.
- Two commercially explicit MY2027 Ranger variants absent from the MMV Discovery proposals: Black 2.0L 4x2 AT Diesel and Limited 3.0 V6 Diesel 4WD AT.
- QA source evidence confirms 8 Ranger variants were present in the original aggregated finding and none represented Black/Limited; they were not rejected by identity matcher. The stored Ford Brand Connector contains general Ranger and Ford index pages, but not the individual Black/Limited comparison pages.
- Inspected OpenAIProductResearchProvider: MMV input previously included searchHints but omitted verified sourceEntries entirely. Forwarding sourceEntries is now implemented and tested, and the prompt explicitly requires model-specific version page exploration before concluding.
- Candidate confidence 0.80 reflects original provider extraction; aggregated NEW_MODEL finding retained representative confidence, not per-version confidence. XLS source warnings included INSUFFICIENT_EVIDENCE. Do not convert 0.80 into certainty merely because the official site now has a version page.
- QA paid brand/MMV reservations remain reserved in ledger; do not repeat a paid MMV run without settling accounting or separate budget approval.
- Supervised FIPE attempt for canonical Ranger XLS 3.0 V6 (job 59d0c5df-bb4f-4341-96ae-2c44b165a503) FAILED with generic worker code. Added constrained FIPE diagnostic code propagation for a future attempt. Do not imply FIPE mapping succeeded.
- Approved MMV identities are preserved, no Black/Limited MMVs created by direct SQL, and no Model Year/product/spec writes were performed.
