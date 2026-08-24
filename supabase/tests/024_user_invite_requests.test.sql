begin;
select plan(12);
select has_table('public', 'user_invite_requests');
select has_column('public', 'user_invite_requests', 'requested_by');
select has_column('public', 'user_invite_requests', 'invitee_email');
select has_column('public', 'user_invite_requests', 'status');
select has_index('public', 'user_invite_requests', 'user_invite_requests_pending_email_uidx');
select policies_are('public', 'user_invite_requests', array[
  'user_invite_requests_insert_own_pending', 'user_invite_requests_select_own'
]);
select table_privs_are('public', 'user_invite_requests', 'anon', array[]::text[]);
select table_privs_are('public', 'user_invite_requests', 'authenticated', array['INSERT','SELECT']);
select table_privs_are('public', 'user_invite_requests', 'service_role', array['DELETE','INSERT','SELECT','UPDATE']);
select col_is_pk('public', 'user_invite_requests', 'id');
select fk_ok('public', 'user_invite_requests', 'requested_by', 'public', 'profiles', 'id');
select fk_ok('public', 'user_invite_requests', 'reviewed_by', 'public', 'profiles', 'id');
select * from finish();
rollback;
