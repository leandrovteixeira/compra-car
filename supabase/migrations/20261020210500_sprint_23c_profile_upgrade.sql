alter table public.profiles add column if not exists phone text, add column if not exists company text, add column if not exists job_title text;
alter table public.profiles add constraint profiles_phone_length_23c check (phone is null or length(phone) <= 40);
alter table public.profiles add constraint profiles_company_length_23c check (company is null or length(company) <= 160);
alter table public.profiles add constraint profiles_job_title_length_23c check (job_title is null or length(job_title) <= 120);
create table public.account_upgrade_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 company text not null check (length(trim(company)) between 2 and 160),
 job_title text not null check (length(trim(job_title)) between 2 and 120),
 contact_phone text not null check (length(trim(contact_phone)) between 6 and 40),
 message text check (message is null or length(message) <= 1500),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),
 check (status <> 'pending' or reviewed_at is null)
);
create unique index account_upgrade_one_pending_23c on public.account_upgrade_requests(user_id) where status='pending';
create index account_upgrade_requests_created_23c on public.account_upgrade_requests(created_at desc);
alter table public.account_upgrade_requests enable row level security;
create policy upgrade_request_read_own_23c on public.account_upgrade_requests for select to authenticated using (user_id = (select auth.uid()));
create policy upgrade_request_insert_own_23c on public.account_upgrade_requests for insert to authenticated with check (user_id = (select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null);
grant select,insert on public.account_upgrade_requests to authenticated;
