-- Sprint 26 QA: preserve the original admission reserve and separately record
-- operator-verified actual OpenAI usage. No change to production.
alter table public.agent_spend_reservations
  add column if not exists actual_cost_usd numeric(12,6),
  add column if not exists reconciliation_source text,
  add column if not exists reconciled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.agent_spend_reservations'::regclass
      and conname='agent_spend_actual_cost_check'
  ) then
    alter table public.agent_spend_reservations
      add constraint agent_spend_actual_cost_check
      check (actual_cost_usd is null or
        (actual_cost_usd>=0 and actual_cost_usd<=amount_usd));
  end if;
end $$;

create or replace function public.agent_spend_reconcile(
  p_reservation_id uuid, p_actual_usd numeric, p_source text
) returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_budget_key text;
  v_cap numeric;
  v_reserved numeric;
  v_status text;
  v_original numeric;
  v_actual numeric;
  v_source text;
begin
  if p_reservation_id is null or p_actual_usd is null or
     p_actual_usd<0 or p_source not in
       ('OPERATOR_CONFIRMED_OPENAI_USAGE','PROVIDER_USAGE') then
    raise exception 'COST_RECONCILIATION_INVALID';
  end if;

  select budget_key into v_budget_key
  from public.agent_spend_reservations where id=p_reservation_id;
  if not found or v_budget_key not like 'qa:%' then
    raise exception 'COST_RECONCILIATION_SCOPE_DENIED';
  end if;

  -- Always lock budget first, consistent with reservation admission.
  select cap_usd,reserved_usd into v_cap,v_reserved
  from public.agent_spend_budgets where budget_key=v_budget_key for update;
  if not found then raise exception 'COST_BUDGET_NOT_CONFIGURED'; end if;

  select status,amount_usd,actual_cost_usd,reconciliation_source
    into v_status,v_original,v_actual,v_source
  from public.agent_spend_reservations
  where id=p_reservation_id and budget_key=v_budget_key for update;
  if not found then raise exception 'COST_RESERVATION_NOT_FOUND'; end if;

  if v_status='COMPLETED' and v_actual is not null then
    if v_actual=p_actual_usd and v_source=p_source then
      return v_reserved; -- exact idempotent replay
    end if;
    raise exception 'COST_ALREADY_RECONCILED';
  end if;
  if v_status<>'UNKNOWN' or p_actual_usd>v_original or
     v_reserved < v_original-p_actual_usd then
    raise exception 'COST_RECONCILIATION_INVALID_STATE';
  end if;

  update public.agent_spend_budgets
    set reserved_usd=reserved_usd-(v_original-p_actual_usd)
  where budget_key=v_budget_key;
  update public.agent_spend_reservations
    set status='COMPLETED', actual_cost_usd=p_actual_usd,
        reconciliation_source=p_source,reconciled_at=now()
  where id=p_reservation_id;
  return v_reserved-v_original+p_actual_usd;
end $$;

create or replace function public.agent_spend_reserve_remaining(
  p_budget_key text, p_model text, p_max_amount_usd numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cap numeric;
  v_reserved numeric;
  v_amount numeric;
  v_id uuid;
begin
  if p_budget_key is null or p_budget_key not like 'qa:%'
     or length(p_budget_key) not between 1 and 120
     or p_model is null or length(p_model) not between 1 and 120
     or p_max_amount_usd is null or p_max_amount_usd<=0
     or p_max_amount_usd>2 then
    raise exception 'COST_INVALID_RESERVATION';
  end if;

  select cap_usd,reserved_usd into v_cap,v_reserved
  from public.agent_spend_budgets where budget_key=p_budget_key for update;
  if not found then raise exception 'COST_BUDGET_NOT_CONFIGURED'; end if;

  v_amount=least(p_max_amount_usd,v_cap-v_reserved);
  if v_amount<0.01 then raise exception 'COST_BUDGET_EXHAUSTED'; end if;

  update public.agent_spend_budgets
    set reserved_usd=reserved_usd+v_amount
  where budget_key=p_budget_key;
  insert into public.agent_spend_reservations (budget_key,model,amount_usd)
    values (p_budget_key,p_model,v_amount) returning id into v_id;

  return jsonb_build_object('id',v_id,'reservedUsd',v_amount);
end $$;

revoke all on function public.agent_spend_reconcile(uuid,numeric,text),
  public.agent_spend_reserve_remaining(text,text,numeric)
  from public,anon,authenticated;
grant execute on function public.agent_spend_reconcile(uuid,numeric,text),
  public.agent_spend_reserve_remaining(text,text,numeric)
  to service_role;
