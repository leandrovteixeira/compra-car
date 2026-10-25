-- Sprint 22.5: QA-only draft. DO NOT apply to production.
-- Shared budget across brands/workers with atomic database row lock.
create table if not exists public.agent_spend_budgets (
  budget_key text primary key,
  cap_usd numeric(12,6) not null check (cap_usd > 0),
  reserved_usd numeric(12,6) not null default 0 check (reserved_usd >= 0),
  created_at timestamptz not null default now(),
  check (reserved_usd <= cap_usd)
);
create table if not exists public.agent_spend_reservations (
  id uuid primary key default gen_random_uuid(),
  budget_key text not null references public.agent_spend_budgets(budget_key),
  model text not null,
  amount_usd numeric(12,6) not null check (amount_usd > 0),
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','UNKNOWN')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.agent_spend_budgets enable row level security;
alter table public.agent_spend_reservations enable row level security;
revoke all on public.agent_spend_budgets, public.agent_spend_reservations from public, anon, authenticated;
grant select, insert, update on public.agent_spend_budgets, public.agent_spend_reservations to service_role;
create or replace function public.agent_spend_reserve(
  p_budget_key text, p_model text, p_amount_usd numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_cap numeric; v_reserved numeric; v_id uuid;
begin
  if p_budget_key is null or length(p_budget_key) not between 1 and 120
     or p_model is null or length(p_model) not between 1 and 120
     or p_amount_usd is null or p_amount_usd <= 0 then
    raise exception 'COST_INVALID_RESERVATION';
  end if;
  select cap_usd, reserved_usd into v_cap, v_reserved
  from public.agent_spend_budgets where budget_key = p_budget_key for update;
  if not found then raise exception 'COST_BUDGET_NOT_CONFIGURED'; end if;
  if v_reserved + p_amount_usd > v_cap then raise exception 'COST_BUDGET_EXHAUSTED'; end if;
  update public.agent_spend_budgets set reserved_usd = reserved_usd + p_amount_usd
    where budget_key = p_budget_key;
  insert into public.agent_spend_reservations (budget_key, model, amount_usd)
    values (p_budget_key, p_model, p_amount_usd) returning id into v_id;
  return v_id;
end $$;
create or replace function public.agent_spend_complete(p_id uuid, p_usage_known boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.agent_spend_reservations
    set status = case when p_usage_known then 'COMPLETED' else 'UNKNOWN' end,
        completed_at = now()
  where id = p_id and status = 'PENDING';
  if not found then raise exception 'COST_RESERVATION_NOT_PENDING'; end if;
  -- Full reserve is intentionally retained, even if actual usage is lower.
end $$;
revoke all on function public.agent_spend_reserve(text,text,numeric), public.agent_spend_complete(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.agent_spend_reserve(text,text,numeric),
  public.agent_spend_complete(uuid,boolean) to service_role;
