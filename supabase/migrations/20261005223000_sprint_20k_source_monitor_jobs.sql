-- Sprint 20K.1: deterministic source monitor jobs and downstream event triggering.

alter table public.agent_jobs
  drop constraint agent_jobs_job_type_check;

alter table public.agent_jobs
  add constraint agent_jobs_job_type_check
  check (job_type in ('MMV_DISCOVERY','BRAND_CONNECTOR','SOURCE_MONITOR'));

create or replace function public.enqueue_source_monitor_job(
  p_brand text,
  p_created_by uuid
)
returns public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare result public.agent_jobs;
begin
  if p_created_by is null
    or coalesce(length(btrim(p_brand)),0) not between 1 and 100
  then raise exception 'AGENT_JOB_INVALID_INPUT';
  end if;

  insert into public.agent_jobs(job_type,status,market,brand,input,created_by)
  values(
    'SOURCE_MONITOR','QUEUED','BR',btrim(p_brand),
    jsonb_build_object('deterministic',true),p_created_by
  )
  returning * into result;

  return result;
exception
  when unique_violation then raise exception 'AGENT_JOB_ALREADY_ACTIVE';
end;
$$;

create or replace function public.complete_agent_job_without_run(p_job_id uuid)
returns public.agent_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare result public.agent_jobs;
begin
  update public.agent_jobs
  set status='COMPLETED',completed_at=now(),error=null,updated_at=now()
  where id=p_job_id and status='RUNNING'
  returning * into result;
  if result.id is null then raise exception 'AGENT_JOB_NOT_RUNNING'; end if;
  return result;
end;
$$;

create or replace function public.enqueue_ai_jobs_for_source_changes(
  p_monitor_job_id uuid,
  p_brand text,
  p_created_by uuid,
  p_change_count integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare enqueued integer := 0;
begin
  if p_change_count <= 0 then return 0; end if;

  update public.agent_source_change_events
  set consumed_by_job_id=p_monitor_job_id
  where consumed_by_job_id is null
    and market='BR'
    and lower(btrim(brand))=lower(btrim(p_brand));

  begin
    insert into public.agent_jobs(job_type,status,market,brand,input,created_by)
    values(
      'BRAND_CONNECTOR','QUEUED','BR',btrim(p_brand),
      jsonb_build_object(
        'provider','openai',
        'persistFindings',true,
        'mode','health-check',
        'reason','SOURCE_CHANGE'
      ),
      p_created_by
    );
    enqueued := enqueued + 1;
  exception when unique_violation then null;
  end;

  begin
    insert into public.agent_jobs(job_type,status,market,brand,input,created_by)
    values(
      'MMV_DISCOVERY','QUEUED','BR',btrim(p_brand),
      jsonb_build_object(
        'provider','openai',
        'persistFindings',true,
        'marketReconcile',false,
        'marketModel',null,
        'reason','SOURCE_CHANGE'
      ),
      p_created_by
    );
    enqueued := enqueued + 1;
  exception when unique_violation then null;
  end;

  return enqueued;
end;
$$;

revoke all on function public.enqueue_source_monitor_job(text,uuid) from public,anon,authenticated;
revoke all on function public.complete_agent_job_without_run(uuid) from public,anon,authenticated;
revoke all on function public.enqueue_ai_jobs_for_source_changes(uuid,text,uuid,integer) from public,anon,authenticated;

grant execute on function public.enqueue_source_monitor_job(text,uuid) to service_role;
grant execute on function public.complete_agent_job_without_run(uuid) to service_role;
grant execute on function public.enqueue_ai_jobs_for_source_changes(uuid,text,uuid,integer) to service_role;
