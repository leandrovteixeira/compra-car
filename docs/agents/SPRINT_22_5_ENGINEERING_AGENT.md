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

## 22.5B — Brand Connector passive instrumentation (implemented on branch)

`scripts/agents/brand-connector-telemetry.ts` wraps the research provider without modifying its response. The CLI writes an additional `<runId>.telemetry.json` alongside its existing local reports. The persisted Agent Platform bundle is unchanged.

Directly observed: research-provider call count, duration, evidence count, unique evidence URLs, candidate domains, source entries and warnings. Not yet instrumented: provider HTTP requests, LLM calls/tokens, cache hits and actual price. All unobserved fields are **null, never 0**. This is not a complete cost baseline.

Next: instrument `@compra-car/adapter-openai` at the actual request boundary with optional counters, use recorded fixtures for cold/warm comparisons, establish semantic equivalence checks, and run full CI validation. No paid OpenAI runs or Supabase writes were triggered by this change.

### Provider-level usage extension
The OpenAI Brand Connector research provider exposes optional `onUsage` with actual completed-response input/output/cached token counters, LLM response count and web-search output count. The CLI merges these into the separate telemetry artifact if a real OpenAI provider supplies them. HTTP request count and cache ratios still need transport instrumentation. USD cost intentionally stays `null` until pricing is versioned. No live provider invocation or CI run was performed in this session; tests are authored but remain unverified.
