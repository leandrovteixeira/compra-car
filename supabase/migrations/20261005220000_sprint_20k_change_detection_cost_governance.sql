-- Sprint 20K: deterministic source monitoring and AI cost governance.

create table public.agent_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market ~ '^[A-Z]{2}$'),
  brand_identity_id uuid references public.brand_identities(id) on delete cascade,
  brand text not null check (length(btrim(brand)) between 1 and 100),
  source_url text not null check (length(btrim(source_url)) between 1 and 2048),
  source_type text,
  http_status integer check (http_status between 100 and 599),
  etag text,
  last_modified text,
  content_length bigint check (content_length is null or content_length >= 0),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  normalized_sha256 text check (normalized_sha256 is null or normalized_sha256 ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (market, source_url, observed_at)
);

create index agent_source_snapshots_latest_idx
  on public.agent_source_snapshots(market, brand, source_url, observed_at desc);

create table public.agent_source_change_events (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market ~ '^[A-Z]{2}$'),
  brand_identity_id uuid references public.brand_identities(id) on delete cascade,
  brand text not null check (length(btrim(brand)) between 1 and 100),
  source_url text not null check (length(btrim(source_url)) between 1 and 2048),
  source_type text,
  change_type text not null check (
    change_type in (
      'FIRST_OBSERVATION',
      'CONTENT_CHANGED',
      'HTTP_STATUS_CHANGED',
      'ETAG_CHANGED',
      'LAST_MODIFIED_CHANGED',
      'SOURCE_UNAVAILABLE',
      'SOURCE_RECOVERED'
    )
  ),
  previous_snapshot_id uuid references public.agent_source_snapshots(id),
  current_snapshot_id uuid not null references public.agent_source_snapshots(id),
  consumed_by_job_id uuid references public.agent_jobs(id) on delete set null,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index agent_source_change_events_pending_idx
  on public.agent_source_change_events(market, brand, detected_at desc)
  where consumed_by_job_id is null;

create table public.agent_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.agent_jobs(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  agent_type text not null,
  market text not null check (market ~ '^[A-Z]{2}$'),
  brand text,
  provider text not null default 'openai',
  model text not null,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  web_search_count integer not null default 0 check (web_search_count >= 0),
  estimated_cost_usd numeric(14,6) not null default 0 check (estimated_cost_usd >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create index agent_ai_usage_events_daily_idx
  on public.agent_ai_usage_events(created_at desc, agent_type, brand);

create table public.agent_cost_policies (
  id uuid primary key default gen_random_uuid(),
  environment text not null unique,
  soft_daily_usd numeric(12,2) not null check (soft_daily_usd >= 0),
  hard_daily_usd numeric(12,2) not null check (hard_daily_usd >= soft_daily_usd),
  hard_per_run_usd numeric(12,2) not null check (hard_per_run_usd >= 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.agent_cost_policies(environment,soft_daily_usd,hard_daily_usd,hard_per_run_usd)
values ('qa', 5.00, 10.00, 3.00)
on conflict (environment) do nothing;

alter table public.agent_source_snapshots enable row level security;
alter table public.agent_source_change_events enable row level security;
alter table public.agent_ai_usage_events enable row level security;
alter table public.agent_cost_policies enable row level security;

revoke all on table
  public.agent_source_snapshots,
  public.agent_source_change_events,
  public.agent_ai_usage_events,
  public.agent_cost_policies
from public,anon,authenticated,service_role;

grant select,insert,update on table
  public.agent_source_snapshots,
  public.agent_source_change_events,
  public.agent_ai_usage_events
to service_role;

grant select,update on table public.agent_cost_policies to service_role;

create or replace function public.agent_daily_ai_cost(p_environment text)
returns numeric
language sql
security invoker
set search_path = ''
as $$
  select coalesce(sum(estimated_cost_usd),0)
  from public.agent_ai_usage_events
  where created_at >= date_trunc('day',now())
    and p_environment = 'qa';
$$;

revoke all on function public.agent_daily_ai_cost(text) from public,anon,authenticated;
grant execute on function public.agent_daily_ai_cost(text) to service_role;
