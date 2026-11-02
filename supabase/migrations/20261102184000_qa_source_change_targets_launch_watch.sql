-- Sprint 26 QA: confirmed source changes no longer enqueue brand-wide MMV AI.
-- Only approved canonical launch-watch targets become due, via a zero-AI queue.
create or replace function public.enqueue_ai_jobs_for_source_changes(
  p_monitor_job_id uuid,p_brand text,p_created_by uuid,p_change_count integer
) returns integer
language plpgsql set search_path='' as $$
declare confirmed_count integer := 0;
begin
  select count(*) into confirmed_count
    from public.agent_source_change_events
    where consumed_by_job_id is null and market='BR'
      and lower(btrim(brand))=lower(btrim(p_brand))
      and confirmation_status='CONFIRMED'
      and change_type<>'FIRST_OBSERVATION';
  if confirmed_count<=0 or p_change_count<=0 then return 0; end if;
  update public.agent_source_change_events
    set consumed_by_job_id=p_monitor_job_id
    where consumed_by_job_id is null and market='BR'
      and lower(btrim(brand))=lower(btrim(p_brand))
      and confirmation_status='CONFIRMED'
      and change_type<>'FIRST_OBSERVATION';
  update public.agent_mmv_launch_watch q
    set next_check_at=now(),updated_at=now()
    from public.catalog_mmvs m
    where q.mmv_id=m.id and m.market='BR' and q.enabled
      and q.launch_state='AWAITING_LAUNCH'
      and lower(btrim(m.brand))=lower(btrim(p_brand));
  return public.qa_enqueue_due_mmv_launch_checks(12);
end $$;
