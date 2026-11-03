# Sprint 26 — GWM / Poer P30 controlled new-brand smoke test

Status: PREFLIGHT ONLY — no paid AI run, no catalog population, no automatic publication.
Environment: Compra Car QA Supabase `shfsjyjxmgwnlexmdkcs`.
Public verification date: 2026-10-29. Baseline data in this file are independent expectations, NOT inputs for the agent.

## Baseline: audited QA state
- `brand_connector_targets`: GWM / BR exists and is enabled.
- No active `brand_connectors` configuration for GWM.
- 28 historical `products` rows for brand GWM; no `catalog_mmvs` rows for GWM.
- Zero Poer products; zero historical GWM agent runs/jobs.
- **2026-10-29 update:** four QA GWM spending-admission budgets exist with US$2 each: BRAND_CONNECTOR, MMV_DISCOVERY, PRODUCT_YEAR, PRICE_INTELLIGENCE (US$8 total). The values are conservative full reservations, NOT actual API bills.
- QA agent worker currently uses OpenAI providers for BRAND_CONNECTOR and MMV_DISCOVERY.
- The Product Year agent reuses MMV discovery evidence only **after** the MMV worker run, but new canonical MMVs still depend on human review/apply. Handoff pool catches missing identities, not an automatic creation authority.

## Official independent golden sources
- Current GWM Brazil model index: https://www.gwmmotors.com.br/pt/modelos
- GWM official media release, 2026-08-05:
  https://www.gwmmotors.com.br/pt/media-center/news/2026/gwm-amplia-a-familia-poer-p30-com-nova-versao-pro-e-mais-equipamentos-na-linha-2027
- GWM October 2026 commercial conditions:
  https://www.gwmmotors.com.br/pt/saiba-mais/condicoes-comerciais
- GWM owner manual index:
  https://www.gwmmotors.com.br/pt/servicos/manuais

## Expected product identities — do not inject into model prompts
Brand: GWM. Commercial model: Poer P30. Body style: pickup, NOT SUV.
MY2027 commercial versions supported by GWM 2026-08-05 release:
1. Poer P30 Pro — manufacturer launch list price R$205000.
2. Poer P30 Trail — manufacturer launch list price R$227000.
3. Poer P30 Exclusive — manufacturer launch list price R$247000.
These are dated reference launch prices, not approved current public MSRP.
Optional Exclusive sunroof has a R$3000 supplement; don't create a fourth MMV for a package without corroborated version identity.

Observed commercial conditions may include Poer P30 Trail 2025/2026 versus
2026/2027 with distinct offered prices; do not replace canonical MSRP with
financing/promotional price or mix production/model year pairs.

## Ordered smoke gates
0. Cost gate. Validate **external enforceable cap** plus shared atomic pre-call
   reservation for Brand/MMV/Price. Verify the QA worker's deployed branch,
   model/provider, retries, max calls and token budget. If missing, no paid run.
1. BRAND_CONNECTOR only: discover and persist official GWM/BR source map.
   Validate official domain, model index, configurator/spec/manual, sources and
   change detection. Operator APPROVE atomically activates source map.
2. MMV_DISCOVERY only, once connector ACTIVE: brand GWM, market BR, preferred
   deterministic cached source retrieval. Assess complete Poer identities and
   ALL discovered GWM models; compare exact IDs/aliases to 28 historical products
   without overwriting legacy data. Record unresolved candidates as review cases.
3. MY only when canonical MMV exists; zero fabricated PY. Unknown identities
   produce internal handoff task, NOT an operator MY approval. Upon canonical
   resolution, resume only affected MY discovery scope.
4. PRICE only with resolved MMVY; compare official dated price vs promotion,
   verify period/currency. Permit absence rather than fabricated values.
5. Validate second run: unchanged inputs should produce near-zero AI cost, no
   duplicated review cases, no duplicate MMV/MY records, no stale prices.
6. Expand to additional GWM model families only after Poer passes identity,
   review and repeat-run gates. Never bulk publish or turn on production cron
   during QA smoke.

## Pass/fail rubric
- Full Poer name, 3 versions and body classification correctly identified.
- Model and version are never truncated to just `Poer` or `P30`.
- No duplicate variants due to aliases or modifier words.
- MY/PY each has explicit official evidence; otherwise defer.
- MSRP vs promotional/financed price separated, period retained.
- No automatic canonical mutation without operator.
- Brand/connector handoff and MMV/Y dependency recorded and resolved.
- All agent calls obey hard cost caps; abort on unknown price or missing usage.
- 2nd run dedupes unchanged evidence and avoids unnecessary paid AI.

## QA actions already performed
- Read-only QA baseline queried and recorded.
- Independent official GWM website/golden sources verified.
- Agent handoff table, intake after Product Year completed and exact MMV resolution
  triggers deployed in QA, with a full BEGIN/ROLLBACK smoke test.
- No GWM OpenAI calls, no GWM Agent Platform findings, no connector activation,
  no Poer MMV/MY or price writes.

## Spending admission pilot — 2026-10-29
- Four QA-only GWM budget rows, each capped at US$2, were added to public.agent_spend_budgets. No API jobs executed as part of creating them.
- The agent-worker now calls the database agent_spend_reserve before every paid Brand/MMV/independent MY/hybrid Price job. Missing budget or exhausted reservation is fail-closed. Reusing an MMV run in MY, deterministic Price and SOURCE_MONITOR do not reserve money.
- Full US$2 is retained until inspected; we do not credit an unknown/failed usage. The application cannot cancel or guarantee the cost of an already-dispatched API call. OpenAI project limits and per-call model/tool limits are a separate requirement.
- Existing agent_cost_policies.qa global daily cap US$10 and per-run policy US$3 is not a substitute for these per-brand admission rows; enforce pilot reservations at worker dispatch.
- Before approving the next paid stage, inspect agent_ai_usage_events by brand and source run, the OpenAI project invoice/usage dashboard, and current budget reservation status. Prior unused residual admission is not automatically replenished.
