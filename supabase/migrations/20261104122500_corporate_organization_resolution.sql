alter table public.account_upgrade_requests
  add column if not exists requested_organization_id uuid
  references public.account_organizations(id) on delete set null;

create index if not exists account_upgrade_requests_requested_org_idx
  on public.account_upgrade_requests(requested_organization_id);

drop policy if exists account_orgs_select_active_for_upgrade on public.account_organizations;
create policy account_orgs_select_active_for_upgrade
  on public.account_organizations
  for select
  to authenticated
  using (status = 'active' and kind = 'corporate');

create or replace function public.review_corporate_upgrade_23c_v2(
  p_request uuid,
  p_decision text,
  p_org_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_subject uuid;
  v_org uuid;
  v_name text;
  v_slug_base text;
  v_slug text;
begin
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

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;

  select user_id
    into v_subject
  from public.account_upgrade_requests
  where id = p_request
    and status = 'pending'
  for update;

  if not found then
    return false;
  end if;

  if p_decision = 'approved' then
    v_name := nullif(trim(p_org_name), '');
    if v_name is null or length(v_name) < 2 or length(v_name) > 160 then
      raise exception 'invalid organization name';
    end if;

    select id, name
      into v_org, v_name
    from public.account_organizations
    where status = 'active'
      and kind = 'corporate'
      and lower(trim(name)) = lower(v_name)
    order by created_at
    limit 1;

    if v_org is null then
      v_name := trim(p_org_name);
      v_slug_base := trim(both '-' from regexp_replace(
        translate(
          lower(v_name),
          'áàâãäåéèêëíìîïóòôõöúùûüçñ',
          'aaaaaaeeeeiiiiooooouuuucn'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ));

      if v_slug_base = '' then
        v_slug_base := 'organization';
      end if;

      v_slug := v_slug_base;
      if exists(select 1 from public.account_organizations where slug = v_slug) then
        v_slug := v_slug_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      end if;

      insert into public.account_organizations(name, slug, kind, status)
      values(v_name, v_slug, 'corporate', 'active')
      returning id, name into v_org, v_name;
    end if;

    if not exists(
      select 1 from public.profiles where id = v_subject and status = 'active'
    ) then
      raise exception 'inactive user';
    end if;

    if exists(
      select 1 from public.account_access_grants
      where user_id = v_subject and access_tier in ('admin', 'master')
    ) then
      raise exception 'privileged user';
    end if;

    insert into public.account_organization_memberships(organization_id, user_id, status)
    values(v_org, v_subject, 'active')
    on conflict (organization_id, user_id)
    do update set status = 'active', updated_at = now();

    insert into public.account_access_grants(user_id, access_tier, organization_id, granted_by)
    values(v_subject, 'corporate', v_org, v_actor)
    on conflict(user_id)
    do update set
      access_tier = 'corporate',
      organization_id = excluded.organization_id,
      granted_by = excluded.granted_by,
      updated_at = now(),
      valid_until = null;

    update public.account_upgrade_requests
    set status = p_decision,
        company = v_name,
        requested_organization_id = v_org,
        reviewed_by = v_actor,
        reviewed_at = now()
    where id = p_request;
  else
    update public.account_upgrade_requests
    set status = p_decision,
        reviewed_by = v_actor,
        reviewed_at = now()
    where id = p_request;
  end if;

  insert into public.account_access_audit(
    request_id,
    actor_id,
    subject_id,
    organization_id,
    decision
  )
  values(p_request, v_actor, v_subject, v_org, p_decision);

  return true;
end
$$;

revoke all on function public.review_corporate_upgrade_23c_v2(uuid, text, text) from public;
revoke all on function public.review_corporate_upgrade_23c_v2(uuid, text, text) from anon;
grant execute on function public.review_corporate_upgrade_23c_v2(uuid, text, text) to authenticated;
