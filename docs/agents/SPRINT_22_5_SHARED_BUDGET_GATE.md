# Sprint 22.5 — Shared budget pilot gate

The Price Agent uses per-call estimated reserves, but does not enforce an absolute provider billing cap. The Brand Connector now requires a cost-admission interface for any real OpenAI transport. Its default CLI intentionally supplies no controller and therefore **fails closed**.

This increment adds a QA-only **draft migration**, `20261009180000_sprint_22_5_agent_spend_budget.sql`, and a Supabase RPC adapter. Reserve is atomic using a row lock in PostgreSQL, so simultaneous workers sharing one budget key cannot both claim the same remaining amount. Completion **never refunds** a reservation, including missing usage or failed responses. RPC errors refuse additional calls. No migration has been applied to a remote database, and the adapter is not wired into the live CLI.

**Important:** these reservations are internal admission estimates, not an absolute provider-enforced billing ceiling. Even with a US$2 budget row, an unexpectedly expensive API response could exceed an internal reserve. The user's authorization of US$2 for Kia + VW is not authorization to run a paid test unless a provider-side/account spending control with sufficiently reliable cutoff is independently verified. No paid run or secret configuration should be used to test this migration.

Next:
1. Validate SQL in isolated/QA PostgreSQL and verify service-role-only access.
2. Review real model/tool maximum cost calculation and bounded search/tool requests.
3. Ensure cancellation, retry, and multiple-worker accounting.
4. Only then consider wiring the controller in QA (still blocked from paid use until provider billing hard ceiling is proven).
5. Continue offline cold/warm golden equivalence tests separately.

Never apply to production; never create a budget row with production credentials.

## QA deployment observation — 2026-10-09

The migration `sprint_22_5_agent_spend_budget` was applied successfully to the **Compra Car Staging** Supabase project (project reference `shfsjyjxmgwnlexmdkcs`). Production was not touched. An attempt to execute SQL validation queries through the connector was blocked by tool security settings, therefore **real Postgres reserve/concurrency behavior is not yet integration-tested**. No pilot budget row was inserted, no API credentials used, and no OpenAI calls issued.

`run-brand-connector.ts` now accepts an explicitly injected `AgentCostAdmission` and passes it to the OpenAI provider. The default CLI path still has **no controller** and rejects paid dispatch. The shared Supabase adapter is available but is **not auto-initialized or used to authorize spending**. Do not mark QA/paid pipeline accepted until database integration testing and provider-enforced charging controls have been independently completed.
