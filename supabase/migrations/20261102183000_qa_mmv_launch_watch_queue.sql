-- Sprint 26 — QA-only MMV launch watch bridge. Operator enrollment required.
-- Deploy to QA project only. Never infer ON_SALE from MMV ACTIVE status.
create table if not exists public.agent_mmv_launch_watch (
  id uuid primary key default gen_random_uuid(),
  mmv_id uuid not null unique references public.catalog_mmvs(id) on delete cascade,
  watcher_candidate_id uuid null references public.watcher_candidates(id) on delete set null,
  origin text not null check(origin in ('WATCHER_APPROVED','MANUAL_APPROVED')),
  enabled boolean not null default false,
  launch_state text not null default 'AWAITING_LAUNCH'
    check(launch_state in ('AWAITING_LAUNCH','EVIDENCE_FOUND','ON_SALE_CONFIRMED','PAUSED')),
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz null,
  last_evidence_hash text null,
  last_finding_id uuid null references public.agent_findings(id) on delete set null,
  approved_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_watch_origin_check check(
    (origin='WATCHER_APPROVED' and watcher_candidate_id is not null) or
    (origin='MANUAL_APPROVED' and watcher_candidate_id is null)
  )
);
create index if not exists agent_mmv_launch_watch_due_idx
 on public.agent_mmv_launch_watch(next_check_at)
 where enabled and launch_state='AWAITING_LAUNCH';
alter table public.agent_mmv_launch_watch enable row level security;
revoke all on public.agent_mmv_launch_watch from public, anon, authenticated;
grant select,insert,update,delete on public.agent_mmv_launch_watch to service_role;

create or replace function public.qa_enqueue_due_mmv_launch_checks(
  p_limit integer default 12
) returns integer
language plpgsql security definer set search_path=''
as $$
declare v record; n int := 0;
begin
  if p_limit < 1 or p_limit > 30 then raise exception 'LAUNCH_QUEUE_LIMIT_INVALID'; end if;
  for v in
    select q.id,q.mmv_id,m.brand
    from public.agent_mmv_launch_watch q
    join public.catalog_mmvs m on m.id=q.mmv_id
    where q.enabled and q.launch_state='AWAITING_LAUNCH'
      and q.next_check_at<=now()
      and m.status='ACTIVE' and m.market='BR'
      and (q.origin='MANUAL_APPROVED' or exists (
        select 1 from public.watcher_candidates w
        where w.id=q.watcher_candidate_id and w.status='EXPECTED_BR'
          and w.market='BR' and lower(w.brand)=lower(m.brand)))
      and exists (
        select 1 from public.brand_connector_targets t
        join public.brand_connectors c on c.target_id=t.id
        where t.brand=m.brand and t.market='BR' and c.status='ACTIVE')
      and not exists (
        select 1 from public.agent_jobs j
        where j.job_type='MMV_DISCOVERY'
          and j.status in ('QUEUED','RUNNING')
          and j.input->>'launchWatchId'=q.id::text)
    order by q.next_check_at,q.id
    for update of q skip locked
    limit p_limit
  loop
    insert into public.agent_jobs(job_type,status,market,brand,input)
    values('MMV_DISCOVERY','QUEUED','BR',v.brand,
      jsonb_build_object('provider','launch-watch-deterministic',
      'launchWatchId',v.id,'mmvId',v.mmv_id,
      'reason','APPROVED_MMV_LAUNCH_CHECK'));
    update public.agent_mmv_launch_watch set
      next_check_at=now()+interval '1 day',updated_at=now()
      where id=v.id;
    n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function public.qa_enqueue_due_mmv_launch_checks(integer)
 from public,anon,authenticated;
grant execute on function public.qa_enqueue_due_mmv_launch_checks(integer)
 to service_role;
