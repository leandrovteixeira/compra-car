-- Separate migration: PostgreSQL enum additions must be committed before use.
alter type public.app_role add value if not exists 'public';
