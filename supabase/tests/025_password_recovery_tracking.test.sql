begin;

select plan(4);

select has_column('public', 'profiles', 'password_recovery_requested_at');
select col_type_is(
  'public',
  'profiles',
  'password_recovery_requested_at',
  'timestamp with time zone'
);
select col_is_null(
  'public',
  'profiles',
  'password_recovery_requested_at'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.profiles',
    'password_recovery_requested_at',
    'UPDATE'
  ),
  'authenticated users cannot alter recovery tracking'
);

select * from finish();

rollback;
