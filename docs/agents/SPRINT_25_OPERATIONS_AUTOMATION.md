# Sprint 25 — Operations / Automation

## Goal

Turn the agent CLIs into a safe, repeatable operational pipeline without granting any
automatic authority to mutate canonical catalog, specs or pricing.

## Implemented slice

- deterministic per-brand pipeline;
- PostgreSQL-backed single-run lease per market;
- bounded retries (0–2; default 1);
- fail-fast dependency ordering;
- dry-run planning with zero remote writes;
- operational audit row with trigger, brands, status, timing, summary and source commit;
- Railway-friendly CLI entry point.

Default sequence:

1. BRAND_CONNECTOR health-check;
2. MMV_DISCOVERY;
3. MODEL_YEAR using the structured provider.

The Model Year stage intentionally uses the structured provider by default to avoid
unbounded OpenAI spend. Brand Connector and MMV Discovery still use their existing
OpenAI-backed implementations; cost reduction inside those agents remains governed by
their own deterministic gates and budgets.

## Explicit exclusions

Spec Source in the current branch requires an exact MMV + MY target and does not expose
a bulk orchestration contract. Price Intelligence is not present in this source lineage.
They are therefore not silently guessed or invoked by Sprint 25. When their newer
branches are merged/pushed, they should be registered as downstream stages behind the
same orchestration lease.

No Accept decision executes a proposal. No canonical product/spec/price row is changed
by the orchestrator.

## CLI

Dry plan:

`pnpm agent:operations -- --brands Jeep,VW --dry-run`

Manual execution:

`pnpm agent:operations -- --brands Jeep,VW --trigger manual`

Scheduled execution:

`pnpm agent:operations -- --brands Jeep,VW --trigger scheduled`

Optional stage subset:

`pnpm agent:operations -- --brands Jeep --stages MODEL_YEAR`

## Railway

Recommended QA/Staging cron service command:

`pnpm agent:operations -- --brands Jeep,Toyota,VW,Audi --trigger scheduled`

Recommended cadence for the first validation gate: once daily. Do not enable Production
until QA demonstrates idempotency, lock behavior, bounded spend and clean zero-change runs.

## Acceptance gates

1. two concurrent starts: one runs, one returns SKIPPED_LOCKED;
2. repeated zero-change execution remains safe;
3. one stage failure prevents downstream stages for that brand and fails the orchestration;
4. retry count never exceeds configured cap;
5. dry-run makes no Supabase/OpenAI calls;
6. operational table is service-role only;
7. Production remains untouched.
