-- Engineering Agent learning telemetry; staging-first, no canonical data mutation.
create table if not exists public.agent_engineering_run_events (
  run_id uuid not null,
  agent text not null check (agent in ('brand-connector','mmv-discovery','price')),
  environment text not null check (environment in ('qa','staging')),
  happened_at timestamptz not null,
  status text not null check (status in ('SUCCESS','FAILED','PARTIAL')),
  duration_ms numeric,
  estimated_cost_usd numeric check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  llm_calls integer check (llm_calls is null or llm_calls >= 0),
  finding_count integer check (finding_count is null or finding_count >= 0),
  source_fingerprint text,
  failures jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  primary key (run_id, agent),
  check (jsonb_typeof(failures) = 'array' and jsonb_array_length(failures) <= 50)
);
create index if not exists agent_engineering_run_events_recent
  on public.agent_engineering_run_events (happened_at desc);
alter table public.agent_engineering_run_events enable row level security;
revoke all on public.agent_engineering_run_events from public, anon, authenticated;
grant select, insert on public.agent_engineering_run_events to service_role;
