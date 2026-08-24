create table public.user_invite_requests (
  id bigint generated always as identity primary key,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  invitee_name text not null,
  invitee_email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  constraint user_invite_requests_name_valid check (
    invitee_name = btrim(invitee_name) and char_length(invitee_name) between 1 and 160
  ),
  constraint user_invite_requests_email_normalized check (
    invitee_email = lower(btrim(invitee_email)) and char_length(invitee_email) between 3 and 254
  ),
  constraint user_invite_requests_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint user_invite_requests_review_consistent check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index user_invite_requests_pending_email_uidx
  on public.user_invite_requests (invitee_email) where status = 'pending';
create index user_invite_requests_requested_by_created_idx
  on public.user_invite_requests (requested_by, created_at desc);
create index user_invite_requests_pending_queue_idx
  on public.user_invite_requests (created_at, id) where status = 'pending';
create index user_invite_requests_reviewed_by_idx
  on public.user_invite_requests (reviewed_by) where reviewed_by is not null;

create function public.protect_user_invite_request_transition()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.requested_by <> old.requested_by
     or new.invitee_name <> old.invitee_name or new.invitee_email <> old.invitee_email
     or new.created_at <> old.created_at then
    raise exception using errcode = '23514', message = 'invite request identity is immutable';
  end if;
  if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
    raise exception using errcode = '23514', message = 'invalid invite request transition';
  end if;
  return new;
end $$;

create trigger user_invite_requests_protect_transition
before update on public.user_invite_requests for each row
execute function public.protect_user_invite_request_transition();

alter table public.user_invite_requests enable row level security;
create policy user_invite_requests_select_own on public.user_invite_requests
  for select to authenticated using (requested_by = (select auth.uid()));
create policy user_invite_requests_insert_own_pending on public.user_invite_requests
  for insert to authenticated with check (
    requested_by = (select auth.uid()) and status = 'pending'
    and reviewed_at is null and reviewed_by is null
  );

revoke all on table public.user_invite_requests from public, anon, authenticated, service_role;
revoke all on sequence public.user_invite_requests_id_seq from public, anon, authenticated, service_role;
grant select, insert on table public.user_invite_requests to authenticated;
grant usage, select on sequence public.user_invite_requests_id_seq to authenticated;
grant select, insert, update, delete on table public.user_invite_requests to service_role;
grant usage, select on sequence public.user_invite_requests_id_seq to service_role;
revoke all on function public.protect_user_invite_request_transition() from public, anon, authenticated, service_role;
