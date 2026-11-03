-- Self-service users are not sellers and may not inherit seller/admin access.
-- Invitation/admin flows still explicitly assign their approved legacy role.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_full_name text;
begin
  profile_full_name := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if profile_full_name is null then
    profile_full_name := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), '');
  end if;

  insert into public.profiles (id, full_name, role, status, invited_at)
  values (
    new.id, profile_full_name,
    'public'::public.app_role,
    'pending'::public.user_status,
    pg_catalog.now()
  );
  return new;
end;
$$;

-- Only a verified, self-registered public profile becomes active.
-- Privileged invitations are updated to seller/admin separately and remain subject
-- to the existing administrative invite confirmation workflow.
create or replace function public.activate_verified_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles
       set status = 'active'
     where id = new.id and role = 'public'::public.app_role and status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function public.activate_verified_public_profile()
  from public, anon, authenticated, service_role;
drop trigger if exists on_auth_user_email_confirmed_activate_public on auth.users;
create trigger on_auth_user_email_confirmed_activate_public
after update of email_confirmed_at on auth.users
for each row
execute function public.activate_verified_public_profile();

comment on function public.activate_verified_public_profile() is
  'Trigger-only; activate public users only after Supabase confirms their email.';
