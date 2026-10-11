# Engineering Agent — Specification V2 (Sprint 22.5)

## Mission
Improve target agent **implementations**, not individual catalog records. Preserve canonical identifiers, official-source precedence, provenance, review state, model/version/MY distinction, history and observation-vs-canonical separation. Correctness dominates recurring cost.

## Deployment sequence
1. Brand Connector — pilot
2. MMV Discovery
3. Model Year
4. Spec — only once its agent and golden fixtures are ready
5. Price — golden reference, **not first optimization target**

## Safety and permissions
- Engineering proposals run only in isolated development branches and QA/Staging.
- No production schema, data, environment variables, automatic merge or canonical publication.
- No unattended paid OpenAI calls; execution uses a strictly capped budget with up-front maximum-call reservation.
- No writes to canonical data to make benchmark outcomes pass.
- Accepting an engineering patch is not equivalent to accepting a business finding.
- No deletions, force pushes, or destructive cleanup of user-owned worktrees.

## Engineering loop
1. Freeze independently reviewed fixtures (sources, canonical snapshot, expected identity-level results, provenance).
2. Baseline with matching mode/snapshot/model/rules. Gather actual tokens, response usage, network fetches and cache lineage; unavailable values remain null.
3. Cluster failure signatures by source type, brand, model, payload shape and reason.
4. State a falsifiable hypothesis and estimate projected recurring savings.
5. Apply a minimal reusable patch (cache → routing → structured parser → conservative normalization → semantic fingerprint → optional model).
6. Add regression tests without weakening golden expectations.
7. Typecheck, unit tests, lint, benchmark, false positive/negative comparison.
8. Reject regressions; accept candidate only for human-reviewed integration. Stop on budget, plateau, safety uncertainty or business-policy change.

## Golden quality gate
`packages/core/src/agents/engineering-golden-benchmark.ts` scores expected identities independently from reported identities and blocks newly introduced false positives, false negatives, incorrect rejections or ambiguity. Fixture content must be reviewed outside the candidate agent. This gate is **necessary but not sufficient**: evidence source precedence, applicability, current-vs-historical logic, provenance and security have separate gates.

The current unit tests use **synthetic Kia and VW identities** to verify scoring behavior. They are **not manufacturer-verified benchmark datasets**, and no real brand quality claims can be drawn from them.

## Future implementation milestones
- 22.5C: golden fixtures and deterministic comparator (in progress)
- 22.5D: structured failure clustering and diagnosis reports
- 22.5E: sandboxed engineering patch loop with CI approval gates
- 22.5F: Kia/VW cold/warm benchmark and candidate comparison

## Model escalation and persistent learning
- Structured payload, accepted reconciliation and stable semantic fingerprints come before LLM research.
- Novel uncertain cases may use a configured cheap model; repair escalation is bounded and conditional.
- Model aliases are **configuration**, not hard-coded commitments to historically named releases.
- Cache entries must carry evidence fingerprint, source, canonical identity, model version, rules version, validation status and invalidation reason.
- Zero token cost for unchanged sources is a goal, not a claim until measured.

## Reporting
For each cycle: hypothesis, code/tests, full before/after quality, usage/cost, risk, reason to accept/reject, uncertainty and next benchmark. Never claim cost savings from missing metrics.

## Mandatory cost-governance remediation gate

Before any paid execution of a target agent, the Engineering Agent MUST audit whether it has a pre-call spending admission control. If missing or incomplete, the **first optimization task** is to implement and test the control; do not proceed to paid benchmarking until the gate passes.

Required properties:
1. Explicit run budget, including a shared aggregate budget for multi-brand pilots.
2. Pricing catalog versioned per model, with input, cached input, output, reasoning (if separately billed) and tool/search fees.
3. Bounded per-call output and bounded web/tool usage; prohibit any model or tool configuration without a defensible conservative upper-bound reservation.
4. Atomic reserve **before dispatch** and reconcile after usage. Reservations must cover concurrent requests and any retries; failed, incomplete or missing-usage responses must not release budget optimistically.
5. Fail closed for unknown models, missing rates, unknown maximum tool consumption, budget exhaustion, or storage/accounting errors.
6. Durable budget scope and audit trail where execution can span processes/workers; process-local counters alone do not enforce a shared cap.
7. Structured metrics: allowed/blocked calls, reserved amount, actual estimated usage, unknown fees and remaining budget. Never include API keys.
8. Deterministic tests for over-budget admission, concurrent requests, retries, unknown pricing, missing usage, interruption and multi-agent totals.
9. Human approval for increasing limits. Never silently relax limits or degrade correctness to reduce cost.

The Price Agent provides a **reference implementation of estimated per-call reserve and post-response usage accounting**, but its current `spent + reserve` guard is not equivalent to an externally enforced hard billing ceiling. Audit and improve that pattern before generalizing it. The OpenAI Responses API itself does not expose a guaranteed per-request dollar-denominated cutoff through this code path. If actual billed cost cannot be upper-bounded, budget authorization alone is **not** permission to proceed. Continue offline or require an independently enforced provider/account spending control proven suitable for the requested ceiling.

Priority sequence for any target: **cost safety gate → instrumentation → deterministic/cache optimization → golden benchmark → paid QA validation**.

## Canonical Price-derived implementation standard (Sprint 22.5)

This is an actionable migration rule for the Engineering Agent. Use `AGENT_COST_POLICY` and `planAgentCostRemediation()` from `packages/core/src/agents/engineering-cost-policy.ts` in target-agent audits, before authorizing any paid run.

**Reuse from the Price Agent**
- Use cache/deterministic source discovery before model inference, then cheapest available model and escalation only for unresolved ambiguity.
- Configure bounded `max_output_tokens`, bounded tool/search calls, `maxRetries: 0` unless retries are separately admitted, versioned model-price tables, cached-input accounting, and web/tool fees.
- Produce model-level usage, estimated cost, reason for escalation, and outcome.

**Correct before replicating**
- The Price Agent's local `spent + reserve` check is an estimate-based guard, not atomic/shared reservation, and it can release the effective cost difference before certainty about external charges.
- Unknown usage (API errors, timeouts, invalid response, missing usage) must keep the full reserved liability.
- Concurrent workers and different agent families must debit the **same** shared run ledger transactionally.
- Agent-local pricing tables are a starting reference, not a source of truth across providers or permanent guaranteed upper bounds.
- The shared `AgentCostAdmission` contract is usable now; the QA migration and Supabase adapter are a prototype. Do not silently inject a controller with guessed model reserves.

**Implementation priority**
1. Brand Connector: use the explicit admission contract and QA ledger; measure telemetry; keep paid execution off until external cap is verified.
2. MMV Discovery: audit existing detection/caching; implement missing controls, escalating only unresolved brand/model cases.
3. Model Year: same cost admission scope, bounded reasoning and tool calls; reuse accepted MMV inputs.
4. Spec Agent: cheapest deterministic extraction first, protect high-volume per-trim workloads.
5. Price Agent: later replace its local `spent + reserve` with the shared reservation mechanism without changing reconciliation quality.

All new paid agents MUST pass the standard profile audit; if any feature is missing, Engineering Agent must create a remediation patch and tests rather than only reporting it. Human review is required before deploy, migration promotion, or changes in spending limits. The user's authorized US$2 Kia/VW pilot must **not** be executed under a mere internal estimated reservation in lieu of a verified hard billing ceiling.
