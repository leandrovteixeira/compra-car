-- Sprint 23C.1 draft: QA/Staging only.
-- No data migration or implicit grants. Apply after review and auth integration.
-- The existing public.profiles.role ('seller'|'admin') is unchanged.
create table if not exists public.account_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'corporate' check (kind in ('corporate','early_access')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.account_organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('member','manager')),
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Global administrative grants remain separate from organization membership.
-- Users cannot write this table through the Data API.
create table if not exists public.account_access_grants (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  access_tier text not null check (access_tier in ('public','corporate','admin','master')),
  organization_id uuid references public.account_organizations(id) on delete restrict,
  valid_until timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_requires_organization check (access_tier <> 'corporate' or organization_id is not null)
);

create index if not exists account_org_memberships_user_idx
  on public.account_organization_memberships(user_id, status);
create index if not exists account_grants_organization_idx
  on public.account_access_grants(organization_id);

alter table public.account_organizations enable row level security;
alter table public.account_organization_memberships enable row level security;
alter table public.account_access_grants enable row level security;

-- Allow members to see *organization metadata*, but not other memberships.
-- An invited/suspended member does not get read access.
create policy account_orgs_select_active_own
on public.account_organizations for select to authenticated
using (exists (
  select 1 from public.account_organization_memberships m
  where m.organization_id = id and m.user_id = (select auth.uid())
    and m.status = 'active' and (m.valid_until is null or m.valid_until > now())
));

create policy account_org_memberships_select_own
on public.account_organization_memberships for select to authenticated
using (user_id = (select auth.uid()));

create policy account_grants_select_own
on public.account_access_grants for select to authenticated
using (user_id = (select auth.uid()));

-- Explicit grants. RLS remains the row-level restriction; there are no
-- INSERT/UPDATE/DELETE policies for end users on these privilege tables.
grant select on public.account_organizations to authenticated;
grant select on public.account_organization_memberships to authenticated;
grant select on public.account_access_grants to authenticated;

-- Deliberately NO seed of the Early Access organization in this draft:
-- create it only after confirming the naming and invitation workflow.
