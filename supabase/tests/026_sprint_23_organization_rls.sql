-- Run in QA only. Fixtures are rolled back; no auth users or grants are created.
begin;
select set_config('test.release_user', (select id::text from public.profiles where status='active' order by created_at limit 1), true);
insert into public.account_organizations(id,name,slug) values
 ('a91c0920-9ff4-4a95-9a26-111111111111','Release RLS A','release-rls-a-20261025'),
 ('a91c0920-9ff4-4a95-9a26-222222222222','Release RLS B','release-rls-b-20261025');
insert into public.account_organization_memberships(organization_id,user_id,status)
values ('a91c0920-9ff4-4a95-9a26-111111111111',current_setting('test.release_user')::uuid,'active');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.release_user'),true);
do $$ begin
 if (select count(*) from public.account_organizations where slug in ('release-rls-a-20261025','release-rls-b-20261025')) <> 1
 then raise exception 'RLS_MEMBER_MUST_SEE_ONLY_OWN_ORGANIZATION'; end if;
 if has_table_privilege('authenticated','public.account_access_grants','INSERT,UPDATE,DELETE')
 then raise exception 'ACCESS_GRANTS_MUST_NOT_BE_USER_WRITABLE'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
do $$ begin
 if exists(select 1 from public.account_organizations where slug in ('release-rls-a-20261025','release-rls-b-20261025'))
 then raise exception 'RLS_NONMEMBER_MUST_SEE_NO_ORGANIZATIONS'; end if;
end $$;
select true as organization_rls_tests_passed;
rollback;
