begin;

set local search_path = extensions, public, pg_catalog;

select no_plan();

select ok(to_regtype('public.app_role') is not null, 'public.app_role exists');
select is(
    (
        select array_agg(enumlabel order by enumsortorder)::text
          from pg_enum
         where enumtypid = 'public.app_role'::regtype
    ),
    '{admin,seller}',
    'app_role has only the approved values in order'
);
select ok(to_regtype('public.user_status') is not null, 'public.user_status exists');
select is(
    (
        select array_agg(enumlabel order by enumsortorder)::text
          from pg_enum
         where enumtypid = 'public.user_status'::regtype
    ),
    '{pending,active,disabled}',
    'user_status has only the approved values in order'
);

select ok(to_regclass('public.profiles') is not null, 'public.profiles exists');
select is(
    (
        select array_agg(column_name order by ordinal_position)::text
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'profiles'
    ),
    '{id,full_name,role,status,invited_by,disabled_by,invited_at,accepted_at,disabled_at,created_at,updated_at}',
    'profiles has exactly the approved columns in order'
);
select is(
    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'),
    'uuid',
    'profiles.id is uuid'
);
select is(
    (select udt_schema || '.' || udt_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'),
    'public.app_role',
    'profiles.role uses public.app_role'
);
select is(
    (select udt_schema || '.' || udt_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status'),
    'public.user_status',
    'profiles.status uses public.user_status'
);
select ok(
    (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'),
    'profiles.full_name is nullable'
);
select ok(
    (select column_default like '%seller%' from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'),
    'profiles.role defaults to seller'
);
select ok(
    (select column_default like '%pending%' from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status'),
    'profiles.status defaults to pending'
);
select ok(
    (select count(*) = 2 and bool_and(column_default is not null) from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('created_at', 'updated_at')),
    'created_at and updated_at have defaults'
);

select is(
    (select confdeltype::text from pg_constraint where conname = 'profiles_id_auth_user_fk'),
    'c',
    'profiles.id cascades when auth.users is deleted'
);
select is(
    (
        select namespace.nspname || '.' || relation.relname
          from pg_constraint as constraint_definition
          join pg_class as relation
            on relation.oid = constraint_definition.confrelid
          join pg_namespace as namespace
            on namespace.oid = relation.relnamespace
         where constraint_definition.conname = 'profiles_id_auth_user_fk'
    ),
    'auth.users',
    'profiles.id references auth.users'
);
select is(
    (select confdeltype::text from pg_constraint where conname = 'profiles_invited_by_fk'),
    'n',
    'profiles.invited_by uses ON DELETE SET NULL'
);
select is(
    (
        select namespace.nspname || '.' || relation.relname
          from pg_constraint as constraint_definition
          join pg_class as relation
            on relation.oid = constraint_definition.confrelid
          join pg_namespace as namespace
            on namespace.oid = relation.relnamespace
         where constraint_definition.conname = 'profiles_invited_by_fk'
    ),
    'public.profiles',
    'profiles.invited_by references public.profiles'
);
select is(
    (select confdeltype::text from pg_constraint where conname = 'profiles_disabled_by_fk'),
    'n',
    'profiles.disabled_by uses ON DELETE SET NULL'
);
select is(
    (
        select namespace.nspname || '.' || relation.relname
          from pg_constraint as constraint_definition
          join pg_class as relation
            on relation.oid = constraint_definition.confrelid
          join pg_namespace as namespace
            on namespace.oid = relation.relnamespace
         where constraint_definition.conname = 'profiles_disabled_by_fk'
    ),
    'public.profiles',
    'profiles.disabled_by references public.profiles'
);

insert into auth.users (id, email, raw_user_meta_data)
values
    (
        '11111111-1111-4111-8111-111111111111',
        'owner@example.invalid',
        '{"full_name":"  Usuário Owner  ","role":"admin","status":"active","invited_by":"11111111-1111-4111-8111-111111111111"}'::jsonb
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'other@example.invalid',
        '{"name":"Usuário Other"}'::jsonb
    ),
    (
        '33333333-3333-4333-8333-333333333333',
        'pending@example.invalid',
        '{}'::jsonb
    ),
    (
        '44444444-4444-4444-8444-444444444444',
        'disabled@example.invalid',
        '{}'::jsonb
    ),
    (
        '55555555-5555-4555-8555-555555555555',
        'actor@example.invalid',
        '{}'::jsonb
    ),
    (
        '66666666-6666-4666-8666-666666666666',
        'cascade@example.invalid',
        '{}'::jsonb
    );

select is(
    (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    1::bigint,
    'the auth trigger creates exactly one profile'
);
select is(
    (select role::text from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'seller',
    'malicious role metadata is ignored'
);
select is(
    (select status::text from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'pending',
    'malicious status metadata is ignored'
);
select ok(
    (select invited_by is null from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'invited_by metadata is ignored'
);
select is(
    (select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'Usuário Owner',
    'full_name metadata is preferred and trimmed'
);
select is(
    (select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
    'Usuário Other',
    'name metadata is the documented fallback'
);
select ok(
    (select full_name is null from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
    'missing presentation metadata produces a null full_name'
);
select ok(
    (select invited_at is not null from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'the auth trigger records invited_at'
);

select throws_ok(
    $$update public.profiles set full_name = '   ' where id = '11111111-1111-4111-8111-111111111111'$$,
    '23514',
    null,
    'blank full_name is rejected'
);
select throws_ok(
    $$update public.profiles set disabled_by = '55555555-5555-4555-8555-555555555555', disabled_at = null where id = '44444444-4444-4444-8444-444444444444'$$,
    '23514',
    null,
    'disabled_by and disabled_at must be null or filled together'
);
select throws_ok(
    $$update public.profiles set disabled_by = '55555555-5555-4555-8555-555555555555', disabled_at = now() where id = '44444444-4444-4444-8444-444444444444'$$,
    '23514',
    null,
    'non-disabled profiles cannot retain disable metadata'
);

update public.profiles
   set status = 'active',
       updated_at = '2000-01-01 00:00:00+00'
 where id in (
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     '55555555-5555-4555-8555-555555555555'
 );

select ok(
    (select updated_at > '2000-01-01 00:00:00+00'::timestamptz from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'updated_at is maintained by the BEFORE UPDATE trigger'
);

update public.profiles
   set status = 'disabled',
       disabled_by = '55555555-5555-4555-8555-555555555555',
       disabled_at = now()
 where id = '44444444-4444-4444-8444-444444444444';
update public.profiles
   set invited_by = '55555555-5555-4555-8555-555555555555'
 where id = '33333333-3333-4333-8333-333333333333';

delete from auth.users
 where id = '55555555-5555-4555-8555-555555555555';

select ok(
    (select invited_by is null from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
    'deleting an inviter sets invited_by to null'
);
select ok(
    (select disabled_by is null and disabled_at is null from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
    'deleting a disabling actor clears disabled_by and disabled_at together'
);

delete from auth.users
 where id = '66666666-6666-4666-8666-666666666666';
select is(
    (select count(*) from public.profiles where id = '66666666-6666-4666-8666-666666666666'),
    0::bigint,
    'deleting auth.users cascades to profiles'
);

set local role anon;
select throws_ok(
    $$select count(*) from public.profiles$$,
    '42501',
    null,
    'anon cannot read profiles'
);
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'authenticated reads only its own profile');
select is(
    (select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
    0::bigint,
    'seller cannot list another profile'
);
with changed as (
    update public.profiles
       set full_name = 'Owner atualizado'
     where id = '11111111-1111-4111-8111-111111111111'
    returning 1
)
select is(
    (select count(*) from changed),
    1::bigint,
    'an active user updates its own full_name'
);
with changed as (
    update public.profiles
       set full_name = 'Outro atualizado'
     where id = '22222222-2222-4222-8222-222222222222'
    returning 1
)
select is(
    (select count(*) from changed),
    0::bigint,
    'an active user cannot update another profile'
);
select throws_ok(
    $$update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'an authenticated user cannot update role'
);
select throws_ok(
    $$update public.profiles set status = 'disabled' where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'an authenticated user cannot update status'
);
select throws_ok(
    $$update public.profiles set invited_by = null where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'an authenticated user cannot update administrative fields'
);
select throws_ok(
    $$update public.profiles set accepted_at = now() where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'an authenticated user cannot update accepted_at'
);
select throws_ok(
    $$update public.profiles set disabled_at = now() where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'an authenticated user cannot update disabled_at'
);
select throws_ok(
    $$update public.profiles set updated_at = now() where id = '11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'an authenticated user cannot update updated_at directly'
);
reset role;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'pending users can read their own status');
with changed as (
    update public.profiles
       set full_name = 'Não permitido'
     where id = '33333333-3333-4333-8333-333333333333'
    returning 1
)
select is(
    (select count(*) from changed),
    0::bigint,
    'pending users cannot update full_name'
);
reset role;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'disabled users can read their own status');
with changed as (
    update public.profiles
       set full_name = 'Não permitido'
     where id = '44444444-4444-4444-8444-444444444444'
    returning 1
)
select is(
    (select count(*) from changed),
    0::bigint,
    'disabled users cannot update full_name'
);
reset role;

select ok(
    (select prosecdef from pg_proc where oid = 'public.handle_new_auth_user()'::regprocedure),
    'the auth hook is SECURITY DEFINER'
);
select ok(
    (select prosecdef from pg_proc where oid = 'public.clear_profile_actor_references_before_delete()'::regprocedure),
    'the actor cleanup hook is SECURITY DEFINER'
);
select ok(
    not (select prosecdef from pg_proc where oid = 'public.set_profiles_updated_at()'::regprocedure),
    'the updated_at hook is SECURITY INVOKER'
);
select ok(
    (
        select count(*) = 3
           and bool_and(owner.rolname = 'postgres')
          from pg_proc as procedure
          join pg_roles as owner
            on owner.oid = procedure.proowner
         where procedure.oid in (
             'public.handle_new_auth_user()'::regprocedure,
             'public.clear_profile_actor_references_before_delete()'::regprocedure,
             'public.set_profiles_updated_at()'::regprocedure
         )
    ),
    'all three trigger functions are owned by postgres'
);
select ok(
    (select array_to_string(proconfig, ',') like 'search_path=%' from pg_proc where oid = 'public.handle_new_auth_user()'::regprocedure),
    'the auth hook has an explicit search_path'
);
select ok(
    (select array_to_string(proconfig, ',') like 'search_path=%' from pg_proc where oid = 'public.clear_profile_actor_references_before_delete()'::regprocedure),
    'the actor cleanup hook has an explicit search_path'
);
select ok(
    (select array_to_string(proconfig, ',') like 'search_path=%' from pg_proc where oid = 'public.set_profiles_updated_at()'::regprocedure),
    'the updated_at hook has an explicit search_path'
);
select ok(
    not has_function_privilege('anon', 'public.handle_new_auth_user()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.handle_new_auth_user()', 'EXECUTE'),
    'browser roles cannot execute the auth hook directly'
);
select ok(
    not has_function_privilege('anon', 'public.clear_profile_actor_references_before_delete()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.clear_profile_actor_references_before_delete()', 'EXECUTE'),
    'browser roles cannot execute the actor cleanup hook directly'
);
select ok(
    not has_function_privilege('anon', 'public.set_profiles_updated_at()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.set_profiles_updated_at()', 'EXECUTE'),
    'browser roles cannot execute the updated_at hook directly'
);
select ok(
    not exists (
        select 1
          from pg_proc as procedure
          cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
         where procedure.oid in (
             'public.handle_new_auth_user()'::regprocedure,
             'public.clear_profile_actor_references_before_delete()'::regprocedure,
             'public.set_profiles_updated_at()'::regprocedure
         )
           and privilege.grantee = 0
           and privilege.privilege_type = 'EXECUTE'
    ),
    'PUBLIC has no direct EXECUTE privilege on trigger functions'
);
select ok(
    has_table_privilege('service_role', 'public.profiles', 'SELECT')
    and has_table_privilege('service_role', 'public.profiles', 'INSERT')
    and has_table_privilege('service_role', 'public.profiles', 'UPDATE')
    and has_table_privilege('service_role', 'public.profiles', 'DELETE'),
    'service_role has the approved DML privileges on profiles'
);
select ok(
    not has_type_privilege('anon', 'public.app_role', 'USAGE')
    and not has_type_privilege('anon', 'public.user_status', 'USAGE'),
    'anon has no USAGE privilege on the application enums'
);
select ok(
    not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'invited_by', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'disabled_by', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'invited_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'accepted_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'disabled_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE'),
    'authenticated has no UPDATE privilege on authorization, lifecycle or audit columns'
);

select * from finish();

rollback;
