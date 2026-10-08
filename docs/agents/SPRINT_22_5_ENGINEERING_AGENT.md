# Sprint 22.5 — Engineering Agent

## Scope and ordering
1. Brand Connector
2. MMV Discovery
3. Model Year
4. Spec Agent, only after its implementation and benchmark
5. Price Agent is a golden reference, **not** the first refactoring target.

## Safety contract
- All activity is Staging/QA only; never mutate production code, schema or data.
- Phase A is deterministic evaluation: **zero LLM/API spending** by the evaluator.
- No autonomous merging, publishing, migrations, price updates, approvals or catalog writes.
- Preserve the existing review workflow and source provenance.
- Candidates must be judged using the same fixture, target, mode and input snapshot as the baseline.
- Engineering findings are heuristic; unchanged counts alone do not prove semantic equivalence.
- Review all recommendations and diffs; regression tests + controlled replay are mandatory before adoption.

## Baseline and gate
Capture per run: target, mode, verified/discovered/rejected identities, HTTP requests, LLM calls/tokens, estimated USD, cache hits/misses, elapsed time. Compare **baseline vs incremental separately**. Estimate savings only from comparable runs.
The first evaluator is `packages/core/src/agents/engineering-agent.ts`; unit tests live in `packages/core/test/engineering-agent.test.ts`. It flags invalid comparisons, higher cost, lower identity-count coverage, low incremental source reuse, and possible redundant LLM calls. It always requires human review.

## Next integration steps
1. Instrument Brand Connector's real transport and provider usage (no inferred token values).
2. Add stable fixture/snapshot IDs and outcome-level semantic checks.
3. Replay cold/warm runs offline and record a signed baseline report.
4. Introduce deterministic fetch/parse/cache optimizations behind flags.
5. Promote fixes only after manual approval and QA regression gates.
