-- Sprint 20H: asynchronous QA agent job queue.
create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('MMV_DISCOVERY')),
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED')),
  market text not null default 'BR' check (market ~ '^[A-Z]{2}$'),
  brand text not null check (length(btrim(brand)) between 1 and 100),
  input jsonb not null default '{}'::jsonb,
  run_id uuid references public.agent_runs(id) on delete set null,
  created_by uuid,
  claimed_at timestamptz,
  completed_at timestamptz,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_jobs_completion_check
    check ((status not in ('COMPLETED','FAILED','CANCELLED')) or completed_at is not null)
);

create index agent_jobs_status_created_idx
  on public.agent_jobs(status, created_at);
create unique index agent_jobs_one_active_mmv_per_brand_idx
  on public.agent_jobs(job_type, market, lower(btrim(brand)))
  where status in ('QUEUED','RUNNING');

alter table public.agent_jobs enable row level security;
revoke all privileges on table public.agent_jobs from public, anon, authenticated, service_role;
grant select, insert, update on table public.agent_jobs to service_role;

create or replace function public.enqueue_mmv_discovery_job(
  p_brand text,
  p_market_reconcile boolean,
  p_market_model text,
  p_created_by uuid
)
returns public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.agent_jobs;
begin
  if p_created_by is null
    or coalesce(length(btrim(p_brand)),0) not between 1 and 100
    or (p_market_model is not null and coalesce(length(btrim(p_market_model)),0) not between 1 and 200)
    or (p_market_model is not null and not p_market_reconcile)
  then
    raise exception 'AGENT_JOB_INVALID_INPUT';
  end if;

  insert into public.agent_jobs (
    job_type, status, market, brand, input, created_by
  )
  values (
    'MMV_DISCOVERY', 'QUEUED', 'BR', btrim(p_brand),
    jsonb_build_object(
      'provider','openai',
      'persistFindings',true,
      'marketReconcile',p_market_reconcile,
      'marketModel',nullif(btrim(coalesce(p_market_model,'')),'')
    ),
    p_created_by
  )
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'AGENT_JOB_ALREADY_ACTIVE';
end;
$$;

create or replace function public.claim_next_agent_job()
returns setof public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  job_id uuid;
begin
  select id into job_id
  from public.agent_jobs
  where status='QUEUED'
  order by created_at, id
  for update skip locked
  limit 1;

  if job_id is null then return; end if;

  return query
  update public.agent_jobs
  set status='RUNNING', claimed_at=now(), updated_at=now()
  where id=job_id and status='QUEUED'
  returning *;
end;
$$;

create or replace function public.complete_agent_job(
  p_job_id uuid,
  p_run_id uuid
)
returns public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.agent_jobs;
begin
  update public.agent_jobs
  set status='COMPLETED',
      run_id=p_run_id,
      completed_at=now(),
      error=null,
      updated_at=now()
  where id=p_job_id and status='RUNNING'
  returning * into result;
  if result.id is null then raise exception 'AGENT_JOB_NOT_RUNNING'; end if;
  return result;
end;
$$;

create or replace function public.fail_agent_job(
  p_job_id uuid,
  p_error jsonb
)
returns public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.agent_jobs;
begin
  update public.agent_jobs
  set status='FAILED',
      completed_at=now(),
      error=coalesce(p_error,'{}'::jsonb),
      updated_at=now()
  where id=p_job_id and status='RUNNING'
  returning * into result;
  if result.id is null then raise exception 'AGENT_JOB_NOT_RUNNING'; end if;
  return result;
end;
$$;

revoke all on function public.enqueue_mmv_discovery_job(text,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.claim_next_agent_job() from public,anon,authenticated;
revoke all on function public.complete_agent_job(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fail_agent_job(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_mmv_discovery_job(text,boolean,text,uuid) to service_role;
grant execute on function public.claim_next_agent_job() to service_role;
grant execute on function public.complete_agent_job(uuid,uuid) to service_role;
grant execute on function public.fail_agent_job(uuid,jsonb) to service_role;
