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
