-- Forward-only vocabulary extension. Historical PRODUCT_YEAR data remains readable.
-- finding_type already accepts nonempty text; no finding constraint change is needed.
begin;
alter table public.agent_runs drop constraint agent_runs_agent_type_check;
alter table public.agent_runs add constraint agent_runs_agent_type_check
  check (agent_type in ('BRAND_CONNECTOR','MMV_DISCOVERY','PRODUCT_YEAR','MODEL_YEAR','SPEC_INTELLIGENCE','PRICE_INTELLIGENCE'));
commit;
-- No data writes, grants, policies, RLS changes, or canonical actions.
