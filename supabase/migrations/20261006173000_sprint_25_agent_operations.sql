-- Sprint 25 — Operations / Automation
-- Operational orchestration only. No canonical catalog/spec/price writes.
create table public.agent_orchestration_runs (
  id uuid primary key,
  orchestration_key text not null check (btrim(orchestration_key) <> ''),
  status text not null check (status in ('RUNNING','COMPLETED','FAILED','CANCELLED')),
  trigger_type text not null check (trigger_type in ('SCHEDULED','MANUAL')),
  market text not null,
  brands text[] not null default '{}',
  started_at timestamptz not null,
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error jsonb,
  source_commit_sha text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_orchestration_runs_time_check
    check (completed_at is null or completed_at >= started_at)
);

create unique index agent_orchestration_one_running_key
  on public.agent_orchestration_runs(orchestration_key)
  where status = 'RUNNING';

create index agent_orchestration_created_idx
  on public.agent_orchestration_runs(created_at desc);

comment on table public.agent_orchestration_runs is
  'Operational scheduler/orchestration executions. Never authorizes canonical writes.';

alter table public.agent_orchestration_runs enable row level security;
revoke all privileges on table public.agent_orchestration_runs
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.agent_orchestration_runs to service_role;
