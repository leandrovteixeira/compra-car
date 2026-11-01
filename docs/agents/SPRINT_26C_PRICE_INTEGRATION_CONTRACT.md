# Sprint 26C — Price Agent integration contract

Status: implementation contract; runtime integration and QA validation pending.

## Scope
Connect the existing Sprint 22 Price Agent to the Sprint 26 dependency engine, cost telemetry, review queue and incremental processing. Do not redesign the review UI, rewrite the pricing algorithm or promote to production in this change.

## Dependency rules
Watcher -> Brand Connector -> MMV Discovery -> FIPE Discovery -> Model Year (conditional).
Price and Spec are parallel downstream consumers of a validated canonical MMV identity. They must not be globally blocked by an unresolved Model Year when their evidence can be safely anchored to an unambiguous MMV; year-specific claims must wait for MY resolution. Do not fabricate MY or price.

## Price job admission
- QA only until end-to-end review.
- Require market, canonical MMV ID, configured sources, job/run identifiers and an idempotency key tied to source revision and scope.
- Accept trigger from completed upstream handoff; accept manual QA rerun with reason.
- Skip unchanged source revisions/known price observations, with zero AI cost where possible.
- Respect per-agent/per-brand budget and reservation checks BEFORE any paid provider call.
- Avoid a second active job for the same MMV and scope. Reserve and release budget on success/failure, with retry-safe reconciliation.

## Persistence and review
- Preserve full evidence provenance: exact source URL, timestamp, currency, amount, offer/price type, market, model identity, and evidence snapshot.
- Emit one actionable finding per distinct price observation/change; one row, one finding, one selected action (APPROVE, REJECT, POSTPONE, MERGE where suitable).
- Keep data ingestion, observations, findings, review decisions and catalog application distinct; no silent promotion of uncertain prices to the canonical catalog.
- Manual approval must be idempotent and subject to existing permission checks; rejected/postponed findings remain auditable.
- Duplicate discovery should merge evidence into an existing case without duplicate pending actions.

## Telemetry
Use existing agent_jobs / agent_runs / agent_ai_usage_events and budget tables. Correlate job_id and run_id; record provider/model, input/output/total tokens, web search count, estimated_cost_usd, market/brand, elapsed time, outcome and error code. Include explicit zero-cost skips. Enforce max USD 2 per brand/agent run until budget policy changes.

## QA acceptance
1. Existing MMV, unchanged source: no duplicate finding and no unnecessary AI charge.
2. Changed public price: one finding, one review action, evidence traceable, no premature catalog write.
3. Multiple sources with identical offer: no duplicate actionable case.
4. Missing MY but unambiguous MMV: safe price observation with no invented MY.
5. Missing MMV / ambiguous identity: escalate instead of applying.
6. Failed fetch/provider: retry-safe job and budget settlement.
7. Same event delivered twice: idempotent persistence.
8. Cross-check usage events against run budget and confirmed price writes.
9. End-to-end staging run from upstream handoff through human review, with readback.
10. Preserve production isolation and keep scheduled QA/production workers from double-billing.

## UI boundary
Do not rework layout yet. Generic review presentation may show one finding/action per row. Agent-specific detail drawers can reveal evidence and payloads. Later UX work must not change storage semantics.
