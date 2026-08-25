alter table public.profiles
add column password_recovery_requested_at timestamptz;

comment on column public.profiles.password_recovery_requested_at is
  'Latest successfully initiated password recovery; cleared after password update.';
