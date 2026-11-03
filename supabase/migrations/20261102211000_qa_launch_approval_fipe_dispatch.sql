-- After operator confirms launch, wake FIPE-first dispatcher for that MMV.
-- Never enqueue paid MY automatically from launch confirmation.
create or replace function public.qa_sync_mmv_launch_review(p_watch_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare q record; v record; new_state text;
begin
  select * into q from public.agent_mmv_launch_watch where id=p_watch_id for update;
  if not found or q.launch_state<>'EVIDENCE_FOUND' or q.last_finding_id is null
  then raise exception 'LAUNCH_WATCH_NOT_AWAITING_REVIEW'; end if;
  select rv.decision,rv.reviewed_by into v
  from public.agent_reviews rv join public.agent_findings f on f.id=rv.finding_id
  where rv.finding_id=q.last_finding_id and f.finding_type='LAUNCH_EVIDENCE'
    and f.subject->>'mmvId'=q.mmv_id::text
  order by rv.created_at desc,rv.id desc limit 1;
  if not found or v.reviewed_by is null then
    raise exception 'LAUNCH_WATCH_OPERATOR_REVIEW_REQUIRED'; end if;
  new_state:=case v.decision when 'ACCEPT' then 'ON_SALE_CONFIRMED'
    when 'REJECT' then 'AWAITING_LAUNCH' else 'EVIDENCE_FOUND' end;
  update public.agent_mmv_launch_watch set launch_state=new_state,
    enabled=case when new_state='ON_SALE_CONFIRMED' then false else enabled end,
    next_check_at=case when v.decision='REJECT' then now()+interval '7 days'
      else next_check_at end, updated_at=now() where id=q.id;
  if new_state='ON_SALE_CONFIRMED' then
    perform public.qa_dispatch_fipe_my(
      (select brand from public.catalog_mmvs where id=q.mmv_id),
      q.mmv_id,false);
  end if;
  return new_state;
end $$;
revoke all on function public.qa_sync_mmv_launch_review(uuid)
 from public,anon,authenticated;
grant execute on function public.qa_sync_mmv_launch_review(uuid) to service_role;
