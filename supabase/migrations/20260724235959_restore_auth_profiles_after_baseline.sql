do $$
begin
    if to_regnamespace('auth') is null
       or to_regclass('auth.users') is null then
        raise exception
            'Auth profiles restore failed: auth.users is required.';
    end if;

    if to_regtype('public.app_role') is null
       or to_regtype('public.user_status') is null
       or to_regclass('public.profiles') is null then
        raise exception
            'Auth profiles restore failed: the legacy baseline must run first.';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'anon')
       or not exists (select 1 from pg_roles where rolname = 'authenticated')
       or not exists (select 1 from pg_roles where rolname = 'service_role') then
        raise exception
            'Auth profiles restore failed: anon, authenticated and service_role roles are required.';
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conrelid = 'public.profiles'::regclass
           and conname = 'profiles_full_name_not_blank'
    ) then
        alter table public.profiles
            add constraint profiles_full_name_not_blank
            check (full_name is null or btrim(full_name) <> '');
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conrelid = 'public.profiles'::regclass
           and conname = 'profiles_disabled_fields_consistent'
    ) then
        alter table public.profiles
            add constraint profiles_disabled_fields_consistent
            check ((disabled_by is null) = (disabled_at is null));
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conrelid = 'public.profiles'::regclass
           and conname = 'profiles_disabled_fields_match_status'
    ) then
        alter table public.profiles
            add constraint profiles_disabled_fields_match_status
            check (
                status = 'disabled'
                or (disabled_by is null and disabled_at is null)
            );
    end if;
end
$$;

do $$
declare
    constraint_oid oid;
    constraint_type "char";
    referenced_relation oid;
    delete_action "char";
    source_columns smallint[];
    target_columns smallint[];
begin
    select
        constraint_entry.oid,
        constraint_entry.contype,
        constraint_entry.confrelid,
        constraint_entry.confdeltype,
        constraint_entry.conkey,
        constraint_entry.confkey
      into
        constraint_oid,
        constraint_type,
        referenced_relation,
        delete_action,
        source_columns,
        target_columns
      from pg_constraint as constraint_entry
     where constraint_entry.conrelid = 'public.profiles'::regclass
       and constraint_entry.conname = 'profiles_id_auth_user_fk';

    if constraint_oid is not null
       and not (
           constraint_type = 'f'
           and referenced_relation = 'auth.users'::regclass
           and delete_action = 'c'
           and source_columns = array[
               (
                   select attribute.attnum
                     from pg_attribute as attribute
                    where attribute.attrelid = 'public.profiles'::regclass
                      and attribute.attname = 'id'
               )
           ]::smallint[]
           and target_columns = array[
               (
                   select attribute.attnum
                     from pg_attribute as attribute
                    where attribute.attrelid = 'auth.users'::regclass
                      and attribute.attname = 'id'
               )
           ]::smallint[]
    ) then
        alter table public.profiles
            drop constraint profiles_id_auth_user_fk;
        constraint_oid := null;
    end if;

    if constraint_oid is null then
        alter table public.profiles
            add constraint profiles_id_auth_user_fk
            foreign key (id)
            references auth.users (id)
            on delete cascade;
    end if;
end
$$;

do $$
declare
    constraint_oid oid;
    constraint_type "char";
    referenced_relation oid;
    delete_action "char";
    source_columns smallint[];
    target_columns smallint[];
begin
    select
        constraint_entry.oid,
        constraint_entry.contype,
        constraint_entry.confrelid,
        constraint_entry.confdeltype,
        constraint_entry.conkey,
        constraint_entry.confkey
      into
        constraint_oid,
        constraint_type,
        referenced_relation,
        delete_action,
        source_columns,
        target_columns
      from pg_constraint as constraint_entry
     where constraint_entry.conrelid = 'public.profiles'::regclass
       and constraint_entry.conname = 'profiles_invited_by_fk';

    if constraint_oid is not null
       and not (
           constraint_type = 'f'
           and referenced_relation = 'public.profiles'::regclass
           and delete_action = 'n'
           and source_columns = array[
               (
                   select attribute.attnum
                     from pg_attribute as attribute
                    where attribute.attrelid = 'public.profiles'::regclass
                      and attribute.attname = 'invited_by'
               )
           ]::smallint[]
           and target_columns = array[
               (
                   select attribute.attnum
                     from pg_attribute as attribute
                    where attribute.attrelid = 'public.profiles'::regclass
                      and attribute.attname = 'id'
               )
           ]::smallint[]
    ) then
        alter table public.profiles
            drop constraint profiles_invited_by_fk;
        constraint_oid := null;
    end if;

    if constraint_oid is null then
        alter table public.profiles
            add constraint profiles_invited_by_fk
            foreign key (invited_by)
            references public.profiles (id)
            on delete set null;
    end if;
end
$$;

do $$
declare
    constraint_oid oid;
    constraint_type "char";
    referenced_relation oid;
    delete_action "char";
    source_columns smallint[];
    target_columns smallint[];
begin
    select
        constraint_entry.oid,
        constraint_entry.contype,
        constraint_entry.confrelid,
        constraint_entry.confdeltype,
        constraint_entry.conkey,
        constraint_entry.confkey
      into
        constraint_oid,
        constraint_type,
        referenced_relation,
        delete_action,
        source_columns,
        target_columns
      from pg_constraint as constraint_entry
     where constraint_entry.conrelid = 'public.profiles'::regclass
       and constraint_entry.conname = 'profiles_disabled_by_fk';

    if constraint_oid is not null
       and not (
           constraint_type = 'f'
           and referenced_relation = 'public.profiles'::regclass
           and delete_action = 'n'
           and source_columns = array[
               (
                   select attribute.attnum
                     from pg_attribute as attribute
                    where attribute.attrelid = 'public.profiles'::regclass
                      and attribute.attname = 'disabled_by'
               )
           ]::smallint[]
           and target_columns = array[
               (
                   select attribute.attnum
                     from pg_attribute as attribute
                    where attribute.attrelid = 'public.profiles'::regclass
                      and attribute.attname = 'id'
               )
           ]::smallint[]
    ) then
        alter table public.profiles
            drop constraint profiles_disabled_by_fk;
        constraint_oid := null;
    end if;

    if constraint_oid is null then
        alter table public.profiles
            add constraint profiles_disabled_by_fk
            foreign key (disabled_by)
            references public.profiles (id)
            on delete set null;
    end if;
end
$$;

create index if not exists profiles_invited_by_idx
    on public.profiles (invited_by);

create index if not exists profiles_disabled_by_idx
    on public.profiles (disabled_by);

create or replace function public.set_profiles_updated_at()
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

create or replace function public.clear_profile_actor_references_before_delete()
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

create or replace function public.handle_new_auth_user()
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
        'seller'::public.app_role,
        'pending'::public.user_status,
        pg_catalog.now()
    );

    return new;
end;
$$;

alter function public.set_profiles_updated_at() owner to postgres;
alter function public.clear_profile_actor_references_before_delete() owner to postgres;
alter function public.handle_new_auth_user() owner to postgres;

revoke all on function public.set_profiles_updated_at()
    from public, anon, authenticated, service_role;
revoke all on function public.clear_profile_actor_references_before_delete()
    from public, anon, authenticated, service_role;
revoke all on function public.handle_new_auth_user()
    from public, anon, authenticated, service_role;

comment on function public.set_profiles_updated_at() is
    'Owned by postgres. Trigger-only function that maintains public.profiles.updated_at with an empty search_path.';
comment on function public.clear_profile_actor_references_before_delete() is
    'Owned by postgres. Trigger-only function that clears the disabled actor and timestamp together before ON DELETE SET NULL is applied.';
comment on function public.handle_new_auth_user() is
    'Owned by postgres. Trigger-only Auth hook. It reads only full_name/name presentation metadata and always creates seller/pending profiles.';

drop trigger if exists profiles_set_updated_at
    on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

drop trigger if exists profiles_clear_actor_references_before_delete
    on public.profiles;
create trigger profiles_clear_actor_references_before_delete
before delete on public.profiles
for each row
execute function public.clear_profile_actor_references_before_delete();

drop trigger if exists on_auth_user_created_create_profile
    on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.profiles no force row level security;

drop policy if exists profiles_select_own
    on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_update_own_full_name_when_active
    on public.profiles;
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
