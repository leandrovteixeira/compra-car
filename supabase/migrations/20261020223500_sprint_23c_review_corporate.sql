create table if not exists public.account_access_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.account_upgrade_requests(id),
  actor_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.profiles(id),
  organization_id uuid references public.account_organizations(id),
  decision text not null check (decision in ('approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.account_access_audit enable row level security;
revoke all on public.account_access_audit from anon, authenticated;
create or replace function public.review_corporate_upgrade_23c(p_request uuid, p_decision text, p_org uuid default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_subject uuid;
begin
  if not exists(
    select 1 from public.account_access_grants g join public.profiles p on p.id=g.user_id
    where g.user_id=v_actor and g.access_tier='master' and p.status='active'
    and (g.valid_until is null or g.valid_until>now())
  ) then raise exception 'not authorized' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  select user_id into v_subject from public.account_upgrade_requests
    where id=p_request and status='pending' for update;
  if not found then return false; end if;
  if p_decision='approved' then
    if not exists(select 1 from public.account_organizations where id=p_org and status='active')
      then raise exception 'invalid organization'; end if;
    if not exists(select 1 from public.profiles where id=v_subject and status='active')
      then raise exception 'inactive user'; end if;
    if exists(select 1 from public.account_access_grants where user_id=v_subject
        and access_tier in ('admin','master')) then raise exception 'privileged user'; end if;
    insert into public.account_organization_memberships(organization_id,user_id,status)
      values(p_org,v_subject,'active')
      on conflict (organization_id,user_id) do update set status='active',updated_at=now();
    insert into public.account_access_grants(user_id,access_tier,organization_id,granted_by)
      values(v_subject,'corporate',p_org,v_actor)
      on conflict(user_id) do update set access_tier='corporate',organization_id=excluded.organization_id,
      granted_by=excluded.granted_by,updated_at=now(),valid_until=null;
  end if;
  update public.account_upgrade_requests set status=p_decision,reviewed_by=v_actor,reviewed_at=now()
    where id=p_request;
  insert into public.account_access_audit(request_id,actor_id,subject_id,organization_id,decision)
    values(p_request,v_actor,v_subject,p_org,p_decision);
  return true;
end $$;
revoke all on function public.review_corporate_upgrade_23c(uuid,text,uuid) from public,anon;
grant execute on function public.review_corporate_upgrade_23c(uuid,text,uuid) to authenticated;
