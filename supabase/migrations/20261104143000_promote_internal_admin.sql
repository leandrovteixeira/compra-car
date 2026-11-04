create or replace function public.promote_internal_admin_23c(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists(
    select 1
    from public.account_access_grants g
    join public.profiles p on p.id = g.user_id
    where g.user_id = v_actor
      and g.access_tier = 'master'
      and p.status = 'active'
      and (g.valid_until is null or g.valid_until > now())
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_user = v_actor then
    return false;
  end if;

  if not exists(
    select 1 from public.profiles
    where id = p_user and status = 'active'
  ) then
    raise exception 'inactive user';
  end if;

  if exists(
    select 1 from public.account_access_grants
    where user_id = p_user and access_tier = 'master'
  ) then
    raise exception 'cannot modify master';
  end if;

  update public.account_organization_memberships
  set status = 'revoked', updated_at = now()
  where user_id = p_user and status = 'active';

  insert into public.account_access_grants(
    user_id, access_tier, organization_id, valid_until, granted_by
  )
  values(p_user, 'admin', null, null, v_actor)
  on conflict(user_id) do update set
    access_tier = 'admin',
    organization_id = null,
    valid_until = null,
    granted_by = excluded.granted_by,
    updated_at = now();

  return true;
end
$$;

revoke all on function public.promote_internal_admin_23c(uuid) from public;
revoke all on function public.promote_internal_admin_23c(uuid) from anon;
grant execute on function public.promote_internal_admin_23c(uuid) to authenticated;
