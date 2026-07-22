begin;

do $$
begin
    if to_regnamespace('auth') is null
       or to_regclass('auth.users') is null then
        raise exception
            'Auth profiles preflight failed: auth.users is required.';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'anon')
       or not exists (select 1 from pg_roles where rolname = 'authenticated')
       or not exists (select 1 from pg_roles where rolname = 'service_role') then
        raise exception
            'Auth profiles preflight failed: anon, authenticated and service_role roles are required.';
    end if;

    if to_regtype('public.app_role') is not null then
        raise exception
            'Auth profiles preflight failed: public.app_role already exists.';
    end if;

    if to_regtype('public.user_status') is not null then
        raise exception
            'Auth profiles preflight failed: public.user_status already exists.';
    end if;

    if to_regclass('public.profiles') is not null then
        raise exception
            'Auth profiles preflight failed: public.profiles already exists.';
    end if;

    if exists (
        select 1
          from pg_proc as procedure
          join pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
         where namespace.nspname = 'public'
           and procedure.proname in (
               'set_profiles_updated_at',
               'clear_profile_actor_references_before_delete',
               'handle_new_auth_user'
           )
    ) then
        raise exception
            'Auth profiles preflight failed: a required public function name already exists.';
    end if;

    if exists (
        select 1
          from pg_trigger
         where not tgisinternal
           and tgname in (
               'profiles_set_updated_at',
               'profiles_clear_actor_references_before_delete',
               'on_auth_user_created_create_profile'
           )
    ) then
        raise exception
            'Auth profiles preflight failed: a required trigger name already exists.';
    end if;
end
$$;

create type public.app_role as enum (
    'admin',
    'vendedor'
);

create type public.user_status as enum (
    'pending',
    'active',
    'disabled'
);

create table public.profiles (
    id uuid primary key,
    full_name text null,
    role public.app_role not null default 'vendedor',
    status public.user_status not null default 'pending',
    invited_by uuid null,
    disabled_by uuid null,
    invited_at timestamptz null,
    accepted_at timestamptz null,
    disabled_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_id_auth_user_fk
        foreign key (id)
        references auth.users (id)
        on delete cascade,
    constraint profiles_invited_by_fk
        foreign key (invited_by)
        references public.profiles (id)
        on delete set null,
    constraint profiles_disabled_by_fk
        foreign key (disabled_by)
        references public.profiles (id)
        on delete set null,
    constraint profiles_full_name_not_blank
        check (full_name is null or btrim(full_name) <> ''),
    constraint profiles_disabled_fields_consistent
        check ((disabled_by is null) = (disabled_at is null)),
    constraint profiles_disabled_fields_match_status
        check (
            status = 'disabled'
            or (disabled_by is null and disabled_at is null)
        )
);

create index profiles_invited_by_idx
    on public.profiles (invited_by);

create index profiles_disabled_by_idx
    on public.profiles (disabled_by);

create function public.set_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at := pg_catalog.now();
    return new;
end;
$$;

alter function public.set_profiles_updated_at() owner to postgres;
revoke all on function public.set_profiles_updated_at()
    from public, anon, authenticated;

comment on function public.set_profiles_updated_at() is
    'Owned by postgres. Trigger-only function that maintains public.profiles.updated_at with an empty search_path.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create function public.clear_profile_actor_references_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles
       set disabled_by = null,
           disabled_at = null
     where disabled_by = old.id
       and id <> old.id;

    return old;
end;
$$;

alter function public.clear_profile_actor_references_before_delete() owner to postgres;
revoke all on function public.clear_profile_actor_references_before_delete()
    from public, anon, authenticated;

comment on function public.clear_profile_actor_references_before_delete() is
    'Owned by postgres. Trigger-only function that clears the disabled actor and timestamp together before ON DELETE SET NULL is applied.';

create trigger profiles_clear_actor_references_before_delete
before delete on public.profiles
for each row
execute function public.clear_profile_actor_references_before_delete();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile_full_name text;
begin
    profile_full_name := nullif(
        pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'),
        ''
    );

    if profile_full_name is null then
        profile_full_name := nullif(
            pg_catalog.btrim(new.raw_user_meta_data ->> 'name'),
            ''
        );
    end if;

    insert into public.profiles (
        id,
        full_name,
        role,
        status,
        invited_at
    )
    values (
        new.id,
        profile_full_name,
        'vendedor'::public.app_role,
        'pending'::public.user_status,
        pg_catalog.now()
    );

    return new;
end;
$$;

alter function public.handle_new_auth_user() owner to postgres;
revoke all on function public.handle_new_auth_user()
    from public, anon, authenticated;

comment on function public.handle_new_auth_user() is
    'Owned by postgres. Trigger-only Auth hook. It reads only full_name/name presentation metadata and always creates vendedor/pending profiles.';

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

revoke all privileges on table public.profiles
    from public, anon, authenticated, service_role;
revoke all privileges on type public.app_role
    from public, anon, authenticated, service_role;
revoke all privileges on type public.user_status
    from public, anon, authenticated, service_role;

grant usage on type public.app_role, public.user_status
    to authenticated, service_role;
grant select on table public.profiles
    to authenticated;
grant update (full_name) on table public.profiles
    to authenticated;
grant select, insert, update, delete on table public.profiles
    to service_role;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own_full_name_when_active
on public.profiles
for update
to authenticated
using (
    id = (select auth.uid())
    and status = 'active'
)
with check (
    id = (select auth.uid())
    and status = 'active'
);

comment on table public.profiles is
    'Authorization source for Compra Car users. Administrative writes require validated server-side Service Role operations.';

do $$
begin
    if not exists (
        select 1
          from pg_class
         where oid = 'public.profiles'::regclass
           and relrowsecurity
           and not relforcerowsecurity
    ) then
        raise exception
            'Auth profiles verification failed: RLS must be enabled without FORCE RLS.';
    end if;

    if (
        select count(*)
          from pg_trigger
         where not tgisinternal
           and tgrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
           and tgname in (
               'profiles_set_updated_at',
               'profiles_clear_actor_references_before_delete',
               'on_auth_user_created_create_profile'
           )
    ) <> 3 then
        raise exception
            'Auth profiles verification failed: expected three application triggers.';
    end if;

    if has_table_privilege('anon', 'public.profiles', 'SELECT')
       or has_table_privilege('authenticated', 'public.profiles', 'INSERT')
       or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
       or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
       or not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') then
        raise exception
            'Auth profiles verification failed: table privileges do not match the approved matrix.';
    end if;
end
$$;

commit;
