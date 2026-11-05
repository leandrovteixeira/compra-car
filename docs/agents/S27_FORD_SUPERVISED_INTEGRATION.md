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
