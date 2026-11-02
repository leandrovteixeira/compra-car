-- Permit first-class FIPE runs to appear in shared telemetry and review views.
alter table public.agent_runs drop constraint if exists agent_runs_agent_type_check;
alter table public.agent_runs add constraint agent_runs_agent_type_check
check (agent_type = any(array[
 'BRAND_CONNECTOR','MMV_DISCOVERY','PRODUCT_YEAR','MODEL_YEAR',
 'SPEC_INTELLIGENCE','PRICE_INTELLIGENCE','FIPE_DISCOVERY'
]::text[]));
