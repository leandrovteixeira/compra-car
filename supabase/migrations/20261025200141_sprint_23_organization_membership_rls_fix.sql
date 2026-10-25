-- Qualify the outer organization id; unqualified id resolves to m.id.
-- Membership and expiry checks remain unchanged. No data mutation.
alter policy account_orgs_select_active_own
on public.account_organizations
using (exists (
  select 1 from public.account_organization_memberships m
  where m.organization_id = account_organizations.id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and (m.valid_until is null or m.valid_until > now())
));
