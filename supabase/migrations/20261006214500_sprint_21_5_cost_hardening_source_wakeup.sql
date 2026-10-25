-- Sprint 21.5: content changes wake MMV discovery only.
-- Brand Connector health checks are explicit/structural, not part of every content refresh.

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
declare confirmed_count integer := 0;
begin
  select count(*) into confirmed_count
  from public.agent_source_change_events
  where consumed_by_job_id is null
    and market='BR'
    and lower(btrim(brand))=lower(btrim(p_brand))
    and confirmation_status='CONFIRMED'
    and change_type <> 'FIRST_OBSERVATION';

  if confirmed_count <= 0 or p_change_count <= 0 then return 0; end if;

  update public.agent_source_change_events
  set consumed_by_job_id=p_monitor_job_id
  where consumed_by_job_id is null
    and market='BR'
    and lower(btrim(brand))=lower(btrim(p_brand))
    and confirmation_status='CONFIRMED'
    and change_type <> 'FIRST_OBSERVATION';

  begin
    insert into public.agent_jobs(job_type,status,market,brand,input,created_by)
    values(
      'MMV_DISCOVERY','QUEUED','BR',btrim(p_brand),
      jsonb_build_object(
        'provider','openai','persistFindings',true,
        'marketReconcile',false,'marketModel',null,
        'reason','CONFIRMED_SOURCE_CHANGE'
      ),
      p_created_by
    );
    enqueued := enqueued + 1;
  exception when unique_violation then null;
  end;

  return enqueued;
end;
$$;
