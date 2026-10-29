# Sprint 26 — Agent-to-Agent Handoff & Human Review Queue (design, not enabled)

Status: QA FOUNDATION IMPLEMENTED 2026-10-29. Durable intake and exact-match completion are active; agent dispatcher/retry budget enforcement are NOT connected. No paid AI call or data backfill was initiated.

## Problem verified on QA, 2026-10-29
- `PRODUCT_YEAR` reported 54 `POSSIBLE_NEW_MMV` observations spanning 15 distinct subjects: missing canonical MMV is a dependency of the MY agent, NOT a direct human MY approval.
- Legacy `MODEL_YEAR` findings on VW are text-identity proposals with no current canonical `mmvId`: informational history, not directly applicable MY review.
- Current `MMV_DISCOVERY` `NEW_MODEL` proposals for Kia EV9 contain GTL/GTL FOSCO, Kia EV5 contains LAND, VW ID.4 contains Pro. The old review UI displayed only model names; the S26 read model now displays the proposed resolved versions.
- `POSSIBLE_BODY_SPLIT` produced 86 legacy events, including generic body suffixes such as SUV and Minivan. Generic descriptors are now suppressed from the **human review projection**; source evidence remains immutable in Agent Platform. Revisit the agent's false-positive rules separately.
- Review records historically repeat across agent runs; a human should see one active business case per relevant canonical identity and material version, with all source-run evidence preserved.

## Responsibilities and handoffs
1. Watcher finds brand/model/event signals. If identity is missing, emit a bounded `DISCOVER_BRAND` or `DISCOVER_MMV` handoff; editorial evidence does NOT authorize creation.
2. Brand Connector owns official source maps; discovered validated sources wake MMV / Price / Specs downstream only when relevant.
3. MMV Discovery owns canonical brand/model/variant identity. An accepted complete MMV proposal creates private `catalog_mmvs` without MY/price/specs.
4. Product Year consumes **canonical MMV IDs**; a missing/multiple match emits `RESOLVE_MMV_IDENTITY` back to MMV, then yields. When resolved it resumes the year discovery. It never adds a user-facing `APPROVE MMV` action.
5. Pricing uses resolved MMVY and price-period keys. Missing identity/year/price source emits internal dependency handoff; no fabricated MSRP.
6. Spec Agent will use canonical specs/aliases and only present unresolved spec creation or merge to humans with full schema validation.

## Proposed durable handoff command
`taskType, originAgent, originFindingRef, targetAgent, market, brandKey, modelKey?, versionKey?, yearPair?, evidenceRefs, contextFingerprint, desiredOutcome, priority, maxAttempts, nextEligibleAt, parentTaskId?, producerVersion, idempotencyKey, costAdmissionScope`.

Suggested lifecycle (INTERNAL, not human-review statuses):
`QUEUED | CLAIMED | BLOCKED | COMPLETED | EXHAUSTED | CANCELLED`.

- Dedupe by semantic key and task type, not run UUID or article.
- If new evidence expands a previous candidate, supersede the incomplete snapshot and retain its provenance; don't create a second operator decision.
- Allow multiple material variants of one model: never silently merge Pro and GTX, or versions with distinct commercial powertrains.
- A task may not requeue itself indefinitely. Cycle detection + attempt caps + cooldown + shared API budget admission.
- Deterministic/cache recheck first; paid AI only under explicit user-approved capped policy.
- Human review queue is a separate projection of `WAITING/APPROVED/REJECTED/POSTPONED` decisions.
- Incomplete evidence is internal `BLOCKED` or `EXHAUSTED`, not a fake operator action.
- On resolved dependency, invalidate the consumer snapshot and re-run *that dependent scope*; don't re-run all brands.

## Approval gates before runtime implementation
- Build/version the handoff table and engine contract with unique active semantic keys and immutable evidence links.
- CAS claim/complete, idempotent replay, permissions, RLS, no browser write access.
- Test duplicate seeds, out-of-order evidence, cycles, lease takeover, provider outage, budget exhaustion, and concurrent consumer runs.
- Pilot QA Brand → MMV → Year → Price with offline fixtures and actual cached sources.
- No bulk paid runs or Production promotion before separate approval.

## UI projection rules already applied in Sprint 26 (read-only)
- Display one current consolidated case, choosing the most complete proposal; preserve original findings.
- Explicitly display brand, model, commercial version(s), confidence, evidence and recommended business decision.
- Only display current applicable new MY findings with an existing UUID `mmvId`.
- Exclude generic-only body suffix candidates from operator review pending better agent evidence.
- Do not show stale legacy ACCEPT as a successful canonical APPROVE.
- Keep operational diagnostics (missing-MMV handoffs, parsing gaps, cost/budget failures) in Flight Control, not the human review inbox.

## QA implementation record (2026-10-29)
- Migration `20261029133259_sprint_26_agent_handoff_pool.sql` applied to QA and tracked in repository.
- Service-only tables `agent_handoff_tasks` and `agent_handoff_observations` have RLS, no anon/authenticated SELECT, no user-facing mutations.
- After `PRODUCT_YEAR` run status changes to COMPLETED, valid `POSSIBLE_NEW_MMV` observations create exactly one semantic `RESOLVE_MMV_IDENTITY` task per normalized BR/brand/model/version key; repeat observations are separate immutable references.
- New canonical MMV with the matching exact version closes QUEUED/BLOCKED/EXHAUSTED tasks. No fuzzy merge.
- `dispatch_enabled=false` by default. No job worker consumes this pool yet; cost gating and lease/retry mechanism need a separate release.
- Flight Control has a read-only delegate section; the human review inbox remains the only area for operator business decisions.
- An isolated synthetic `PRODUCT_YEAR` run and a matching canonical MMV were created inside a single transaction to verify intake+resolution; all test writes were rolled back.
- GWM official Poer smoke plan: `SPRINT_26_GWM_POER_SMOKE_PREFLIGHT.md`. GWM currently has no active connector and no cap configured for the paid pilot; no GWM agents executed.
