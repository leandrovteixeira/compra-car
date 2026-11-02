-- Explicit operator-approved enrollment. The Watcher alone NEVER enrolls or
-- triggers MMV AI. QA service layer must pass the operator who approved the
-- canonical identity; this RPC cannot be invoked by public clients.
create or replace function public.qa_enroll_mmv_launch_watch(
  p_mmv_id uuid,p_approved_by uuid,p_watcher_candidate_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare m record; w record; target_id uuid;
begin
  select id,brand,market,status into m from public.catalog_mmvs where id=p_mmv_id;
  if not found or m.status<>'ACTIVE' or m.market<>'BR' then
    raise exception 'LAUNCH_WATCH_CANONICAL_MMV_REQUIRED';
  end if;
  if p_approved_by is null or not exists(select 1 from auth.users where id=p_approved_by)
  then raise exception 'LAUNCH_WATCH_OPERATOR_REQUIRED'; end if;
  if p_watcher_candidate_id is not null then
    select id,status,market,brand into w from public.watcher_candidates
      where id=p_watcher_candidate_id;
    if not found or w.status<>'EXPECTED_BR' or w.market<>'BR' or lower(w.brand)<>lower(m.brand)
    then raise exception 'LAUNCH_WATCH_WATCHER_NOT_VALIDATED'; end if;
  end if;
  insert into public.agent_mmv_launch_watch(
    mmv_id,watcher_candidate_id,origin,enabled,launch_state,next_check_at,approved_by)
  values(p_mmv_id,p_watcher_candidate_id,
    case when p_watcher_candidate_id is null then 'MANUAL_APPROVED' else 'WATCHER_APPROVED' end,
    true,'AWAITING_LAUNCH',now(),p_approved_by)
  on conflict(mmv_id) do nothing
  returning id into target_id;
  if target_id is null then
    select id into target_id from public.agent_mmv_launch_watch where mmv_id=p_mmv_id;
  end if;
  return target_id;
end $$;
revoke all on function public.qa_enroll_mmv_launch_watch(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.qa_enroll_mmv_launch_watch(uuid,uuid,uuid)
  to service_role;
