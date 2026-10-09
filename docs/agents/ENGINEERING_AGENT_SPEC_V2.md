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
