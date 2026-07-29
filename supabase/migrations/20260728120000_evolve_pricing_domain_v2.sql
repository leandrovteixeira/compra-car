-- Pricing Domain V2: Product-owned policies, N:N offer memberships and independent lifecycles.
-- This migration is forward-only. It fails before enforcing NOT NULL when an existing policy
-- cannot be assigned to exactly one product from authoritative relational data.

alter table public.commercial_policies
  add column product_id integer;

-- The new ownership column is populated from existing authoritative relationships. Temporarily
-- remove only the generic UPDATE triggers so terminal rows can receive that backfill without
-- changing their operational updated_at/lock_version. Both protections are restored below in the
-- same transaction, before the new model becomes visible.
drop trigger commercial_policies_prevent_terminal_migration_rule_change
  on public.commercial_policies;
drop trigger commercial_policies_set_pricing_updated_at
  on public.commercial_policies;

update public.commercial_policies as policy
   set product_id = offer.product_id
  from public.commercial_offers as offer
 where policy.commercial_offer_id = offer.id;

with single_product_application as (
  select application.policy_id, min(application.product_id) as product_id
    from public.commercial_policy_applications as application
   group by application.policy_id
  having count(distinct application.product_id) = 1
)
update public.commercial_policies as policy
   set product_id = application.product_id
  from single_product_application as application
 where policy.product_id is null
   and application.policy_id = policy.id;

do $$
declare
  unresolved_count bigint;
begin
  select count(*) into unresolved_count
    from public.commercial_policies
   where product_id is null;

  if unresolved_count > 0 then
    raise exception using
      errcode = '23502',
      message = format(
        'Pricing Domain V2 cannot infer product_id for %s commercial policies; migration aborted without arbitrary assignment',
        unresolved_count
      );
  end if;
end;
$$;

alter table public.commercial_policies
  alter column product_id set not null,
  add constraint commercial_policies_product_id_fkey
    foreign key (product_id) references public.products(id) on delete restrict;

create index commercial_policies_product_status_dates_idx
  on public.commercial_policies (product_id, status, starts_on, ends_on);

create trigger commercial_policies_set_pricing_updated_at
before update on public.commercial_policies
for each row execute function public.set_pricing_updated_at();

create trigger commercial_policies_prevent_terminal_migration_rule_change
before update on public.commercial_policies
for each row execute function public.prevent_terminal_pricing_migration_rule_change();

create table public.commercial_offer_policies (
  commercial_offer_id bigint not null,
  commercial_policy_id bigint not null,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  constraint commercial_offer_policies_pkey
    primary key (commercial_offer_id, commercial_policy_id),
  constraint commercial_offer_policies_offer_id_fkey
    foreign key (commercial_offer_id)
    references public.commercial_offers(id) on delete cascade,
  constraint commercial_offer_policies_policy_id_fkey
    foreign key (commercial_policy_id)
    references public.commercial_policies(id) on delete restrict,
  constraint commercial_offer_policies_created_by_fkey
    foreign key (created_by)
    references public.profiles(id) on delete set null
);

create index commercial_offer_policies_policy_offer_idx
  on public.commercial_offer_policies (commercial_policy_id, commercial_offer_id);

insert into public.commercial_offer_policies (
  commercial_offer_id,
  commercial_policy_id,
  created_at,
  created_by
)
select policy.commercial_offer_id,
       policy.id,
       policy.created_at,
       policy.created_by
  from public.commercial_policies as policy
 where policy.commercial_offer_id is not null;

do $$
declare
  source_count bigint;
  membership_count bigint;
begin
  select count(*) into source_count
    from public.commercial_policies
   where commercial_offer_id is not null;
  select count(*) into membership_count
    from public.commercial_offer_policies;

  if source_count <> membership_count then
    raise exception using
      errcode = '23514',
      message = format(
        'Pricing Domain V2 membership backfill mismatch: source=%s memberships=%s',
        source_count,
        membership_count
      );
  end if;
end;
$$;

drop trigger if exists commercial_policies_validate_legacy_publication
  on public.commercial_policies;
drop function if exists public.validate_legacy_policy_publication();
drop index if exists public.commercial_policies_commercial_offer_id_idx;
alter table public.commercial_policies
  drop constraint commercial_policies_commercial_offer_id_fkey,
  drop column commercial_offer_id;

alter table public.commercial_offer_policies enable row level security;
revoke all privileges on table public.commercial_offer_policies
from public, anon, authenticated, service_role;
grant select on table public.commercial_offer_policies to service_role;

alter table public.pricing_import_batches
  drop constraint pricing_import_batches_source_type_check;

create or replace function public.validate_commercial_offer_policy_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  offer_record public.commercial_offers%rowtype;
  policy_record public.commercial_policies%rowtype;
  offer_id_to_validate bigint;
  policy_id_to_validate bigint;
begin
  offer_id_to_validate := case when tg_op = 'DELETE' then old.commercial_offer_id else new.commercial_offer_id end;
  policy_id_to_validate := case when tg_op = 'DELETE' then old.commercial_policy_id else new.commercial_policy_id end;

  select * into offer_record
    from public.commercial_offers
   where id = offer_id_to_validate
   for key share;
  if not found then
    raise exception using errcode = '23503', message = 'commercial offer membership requires an existing offer';
  end if;
  if offer_record.status <> 'draft' then
    raise exception using errcode = '55000', message = 'memberships of published or archived commercial offers are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select * into policy_record
    from public.commercial_policies
   where id = policy_id_to_validate
   for key share;
  if not found then
    raise exception using errcode = '23503', message = 'commercial offer membership requires an existing policy';
  end if;
  if policy_record.status in ('rejected', 'archived') then
    raise exception using errcode = '23514', message = 'rejected or archived commercial policy cannot be added to an offer';
  end if;
  if policy_record.product_id <> offer_record.product_id then
    raise exception using errcode = '23514', message = 'commercial offer and policy must belong to the same product';
  end if;
  if policy_record.starts_on > offer_record.valid_from
     or (policy_record.ends_on is not null and policy_record.ends_on < offer_record.valid_to) then
    raise exception using errcode = '23514', message = 'commercial policy must cover the complete offer validity period';
  end if;

  return new;
end;
$$;

create trigger commercial_offer_policies_validate_membership
before insert or update or delete on public.commercial_offer_policies
for each row execute function public.validate_commercial_offer_policy_membership();

create or replace function public.validate_commercial_policy_for_publication(p_policy_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  policy_record public.commercial_policies%rowtype;
  base_price_amount numeric;
  reference_rate numeric;
  promotional_rate numeric;
  promotional_payment numeric;
  promotional_present_value numeric;
  expected_financing_benefit numeric;
begin
  select * into policy_record
    from public.commercial_policies
   where id = p_policy_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'commercial policy does not exist';
  end if;
  if not exists (select 1 from public.products where id = policy_record.product_id) then
    raise exception using errcode = '23514', message = 'commercial policy requires an existing product';
  end if;
  if policy_record.ends_on is not null and policy_record.ends_on < policy_record.starts_on then
    raise exception using errcode = '23514', message = 'commercial policy period is invalid';
  end if;
  if policy_record.customer_benefit_amount is null or policy_record.customer_benefit_amount <= 0 then
    raise exception using errcode = '23514', message = 'published commercial policy requires a positive customer benefit amount';
  end if;

  if policy_record.source_import_row_id is not null then
    if not exists (
      select 1 from public.pricing_import_rows as import_row
       where import_row.id = policy_record.source_import_row_id
    ) or not exists (
      select 1 from public.pricing_import_row_outputs as output
       where output.import_row_id = policy_record.source_import_row_id
         and output.policy_id = policy_record.id
    ) then
      raise exception using errcode = '23514', message = 'commercial policy batch source and output are inconsistent';
    end if;
  elsif exists (
    select 1 from public.pricing_import_row_outputs as output
     where output.policy_id = policy_record.id
  ) then
    raise exception using errcode = '23514', message = 'commercial policy output requires source_import_row_id';
  end if;

  if policy_record.calculation_base_price_id is not null then
    select price.amount into base_price_amount
      from public.product_public_prices as price
     where price.id = policy_record.calculation_base_price_id
       and price.product_id = policy_record.product_id
       and price.status = 'published'
       and price.amount > 0
       and price.currency_code = 'BRL'
       and (price.price_type is null or price.price_type = 'msrp')
       and price.starts_on <= policy_record.starts_on
       and (
         price.ends_on is null
         or (policy_record.ends_on is not null and price.ends_on >= policy_record.ends_on)
       );
    if not found then
      raise exception using errcode = '23514', message = 'commercial policy requires a compatible published MSRP';
    end if;
  end if;

  if (policy_record.dealer_rebate_amount is null) is distinct from
     (policy_record.dealer_rebate_allocation_method is null) then
    raise exception using errcode = '23514', message = 'dealer rebate amount and allocation method must be set together';
  end if;
  if policy_record.dealer_rebate_amount is not null and (
       policy_record.dealer_rebate_amount <= 0
       or policy_record.policy_type::text not in ('retail_bonus', 'trade_in_bonus', 'subsidized_financing')
       or policy_record.dealer_rebate_allocation_method::text not in ('explicit_legacy_component', 'proportional_legacy_total')
     ) then
    raise exception using errcode = '23514', message = 'dealer rebate allocation is not publishable';
  end if;

  if policy_record.policy_type::text in (
    'retail_bonus', 'trade_in_bonus', 'free_wallbox', 'free_maintenance'
  ) then
    if policy_record.calculation_method::text <> 'fixed_amount'
       or policy_record.fixed_amount is null
       or policy_record.fixed_amount <= 0
       or policy_record.customer_benefit_amount is distinct from policy_record.fixed_amount then
      raise exception using errcode = '23514', message = 'fixed commercial policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'free_ipva' then
    if policy_record.calculation_method::text <> 'proportional_ipva'
       or policy_record.annual_rate is null or policy_record.annual_rate <= 0 or policy_record.annual_rate > 1
       or policy_record.calculation_base_price_id is null
       or policy_record.offer_month is null or policy_record.offer_month not between 1 and 12
       or policy_record.remaining_months is null or policy_record.remaining_months <> 13 - policy_record.offer_month
       or policy_record.customer_benefit_amount is distinct from
          round(base_price_amount * policy_record.annual_rate * policy_record.remaining_months / 12, 2) then
      raise exception using errcode = '23514', message = 'proportional IPVA policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'free_insurance' then
    if policy_record.calculation_method::text <> 'percentage_of_msrp'
       or policy_record.coverage_years is null or policy_record.coverage_years <= 0
       or policy_record.annual_rate is null or policy_record.annual_rate <= 0 or policy_record.annual_rate > 1
       or policy_record.calculation_base_price_id is null
       or policy_record.customer_benefit_amount is distinct from
          round(base_price_amount * policy_record.annual_rate * policy_record.coverage_years, 2) then
      raise exception using errcode = '23514', message = 'insurance policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'subsidized_financing' then
    if policy_record.calculation_method::text <> 'discounted_promotional_cash_flow_difference'
       or policy_record.term_months is null or policy_record.term_months <= 0
       or policy_record.customer_interest_rate_monthly is null or policy_record.customer_interest_rate_monthly < 0
       or policy_record.down_payment_percentage is null
       or policy_record.down_payment_percentage < 0 or policy_record.down_payment_percentage >= 100
       or policy_record.financed_principal is null or policy_record.financed_principal <= 0
       or policy_record.financial_parameter_set_id is null
       or policy_record.calculation_base_price_id is null then
      raise exception using errcode = '23514', message = 'financing policy is not publishable';
    end if;
    if policy_record.financed_principal is distinct from
       round(base_price_amount * (1 - policy_record.down_payment_percentage / 100), 2) then
      raise exception using errcode = '23514', message = 'financing principal does not match MSRP and down payment';
    end if;
    select coalesce(
             parameter_set.monthly_reference_rate,
             (parameter_set.cdi_monthly_percentage + parameter_set.spread_monthly_percentage) / 100
           ) into reference_rate
      from public.financial_parameter_sets as parameter_set
     where parameter_set.id = policy_record.financial_parameter_set_id
       and parameter_set.status = 'published'
       and coalesce(
             parameter_set.monthly_reference_rate,
             (parameter_set.cdi_monthly_percentage + parameter_set.spread_monthly_percentage) / 100
           ) >= 0
       and parameter_set.effective_from <= policy_record.starts_on
       and (
         parameter_set.valid_to is null
         or (policy_record.ends_on is not null and parameter_set.valid_to >= policy_record.ends_on)
       );
    if not found then
      raise exception using errcode = '23514', message = 'financing requires compatible published financial parameters';
    end if;
    promotional_rate := policy_record.customer_interest_rate_monthly / 100;
    promotional_payment := case
      when promotional_rate = 0 then policy_record.financed_principal / policy_record.term_months
      else policy_record.financed_principal * promotional_rate
        * power(1 + promotional_rate, policy_record.term_months)
        / (power(1 + promotional_rate, policy_record.term_months) - 1)
    end;
    promotional_present_value := case
      when reference_rate = 0 then promotional_payment * policy_record.term_months
      else promotional_payment
        * (1 - power(1 + reference_rate, -policy_record.term_months)) / reference_rate
    end;
    expected_financing_benefit := round(policy_record.financed_principal - promotional_present_value, 2);
    if expected_financing_benefit <= 0
       or policy_record.customer_benefit_amount is distinct from expected_financing_benefit then
      raise exception using errcode = '23514', message = 'financing benefit does not match the approved calculation';
    end if;
  elsif policy_record.policy_type::text = 'free_registration' then
    if policy_record.calculation_method::text <> 'percentage_of_msrp'
       or policy_record.percentage_rate is distinct from 0.01
       or policy_record.calculation_base_price_id is null
       or policy_record.fixed_amount is not null
       or policy_record.customer_benefit_amount is distinct from round(base_price_amount * 0.01, 2) then
      raise exception using errcode = '23514', message = 'registration policy must equal one percent of its MSRP';
    end if;
  elsif policy_record.policy_type::text = 'fuel_or_recharge_voucher' then
    if policy_record.calculation_method::text <> 'fixed_amount'
       or policy_record.fixed_amount is null
       or policy_record.fixed_amount <= 0
       or policy_record.customer_benefit_amount is distinct from policy_record.fixed_amount
       or policy_record.voucher_type is null
       or policy_record.voucher_type not in ('fuel', 'electric_recharge', 'unspecified') then
      raise exception using errcode = '23514', message = 'voucher policy is not publishable';
    end if;
  elsif policy_record.policy_type::text = 'other' then
    if policy_record.calculation_method::text <> 'fixed_amount'
       or policy_record.fixed_amount is null
       or policy_record.fixed_amount <= 0
       or policy_record.customer_benefit_amount is distinct from policy_record.fixed_amount
       or (
         policy_record.legacy_policy_source is distinct from 'others_bonus'
         and nullif(btrim(policy_record.description), '') is null
       ) then
      raise exception using errcode = '23514', message = 'other policy is not publishable';
    end if;
  else
    raise exception using errcode = '23514', message = 'deprecated or unsupported policy type is not publishable';
  end if;
end;
$$;

create or replace function public.validate_commercial_policy_for_offer(
  p_policy_id bigint,
  p_offer_id bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  policy_record public.commercial_policies%rowtype;
  offer_record public.commercial_offers%rowtype;
begin
  select * into offer_record from public.commercial_offers where id = p_offer_id;
  if not found then raise exception using errcode = 'P0002', message = 'commercial offer does not exist'; end if;
  select * into policy_record from public.commercial_policies where id = p_policy_id;
  if not found then raise exception using errcode = 'P0002', message = 'commercial policy does not exist'; end if;
  if not exists (
    select 1 from public.commercial_offer_policies
     where commercial_offer_id = p_offer_id and commercial_policy_id = p_policy_id
  ) then
    raise exception using errcode = '23514', message = 'commercial policy is not a member of the offer';
  end if;
  if policy_record.status <> 'published' then
    raise exception using errcode = '23514', message = 'commercial offer requires published policies';
  end if;
  if policy_record.product_id <> offer_record.product_id then
    raise exception using errcode = '23514', message = 'commercial offer and policy must belong to the same product';
  end if;
  if policy_record.starts_on > offer_record.valid_from
     or (policy_record.ends_on is not null and policy_record.ends_on < offer_record.valid_to) then
    raise exception using errcode = '23514', message = 'commercial policy must cover the complete offer validity period';
  end if;
  perform public.validate_commercial_policy_for_publication(policy_record.id);
end;
$$;

create or replace function public.assert_commercial_offer_publishable(p_offer_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  offer_record public.commercial_offers%rowtype;
  policy_record record;
  public_price_amount numeric;
  offer_benefit_amount numeric;
begin
  select * into offer_record from public.commercial_offers where id = p_offer_id;
  if not found then raise exception using errcode = 'P0002', message = 'commercial offer does not exist'; end if;
  if offer_record.status <> 'draft' then
    raise exception using errcode = '55000', message = 'commercial offer is not in a publishable transition state';
  end if;
  if jsonb_typeof(offer_record.blocking_issues) <> 'array'
     or jsonb_array_length(offer_record.blocking_issues) > 0 then
    raise exception using errcode = '23514', message = 'commercial offer has blocking issues';
  end if;
  select price.amount into public_price_amount
    from public.product_public_prices as price
   where price.id = offer_record.public_price_id
     and price.product_id = offer_record.product_id
     and price.status = 'published'
     and price.amount > 0
     and price.currency_code = 'BRL'
     and (price.price_type is null or price.price_type = 'msrp')
     and price.starts_on <= offer_record.valid_from
     and (price.ends_on is null or price.ends_on >= offer_record.valid_to);
  if not found then
    raise exception using errcode = '23514', message = 'commercial offer requires a compatible published MSRP';
  end if;
  if not exists (
    select 1 from public.commercial_offer_policies
     where commercial_offer_id = offer_record.id
  ) then
    raise exception using errcode = '23514', message = 'commercial offer requires at least one policy';
  end if;

  offer_benefit_amount := 0;
  for policy_record in
    select policy.id, policy.customer_benefit_amount
      from public.commercial_offer_policies as membership
      join public.commercial_policies as policy on policy.id = membership.commercial_policy_id
     where membership.commercial_offer_id = offer_record.id
     order by policy.id
  loop
    perform public.validate_commercial_policy_for_offer(policy_record.id, offer_record.id);
    offer_benefit_amount := offer_benefit_amount + policy_record.customer_benefit_amount;
  end loop;

  if offer_benefit_amount > public_price_amount then
    raise exception using errcode = '23514', message = 'commercial offer benefit cannot exceed its public price';
  end if;
end;
$$;

create or replace function public.validate_commercial_policy_publication_v2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    -- Migration/pgTAP owners may create terminal fixtures directly. Operational roles remain
    -- constrained to the publication RPC; an INSERT row cannot be re-read by the validator yet.
    if tg_op = 'INSERT' and current_user = 'postgres'
       and nullif(current_setting('app.pricing_commercial_policy_publication_id', true), '') is null then
      return new;
    end if;
    if current_user <> 'postgres'
       or nullif(current_setting('app.pricing_commercial_policy_publication_id', true), '') is not null then
      if current_setting('app.pricing_commercial_policy_publication_id', true) is distinct from new.id::text then
        raise exception using errcode = '42501', message = 'commercial policy publication requires publish_commercial_policy';
      end if;
    end if;
    perform public.validate_commercial_policy_for_publication(new.id);
  end if;
  return new;
end;
$$;

create trigger commercial_policies_validate_publication_v2
before insert or update on public.commercial_policies
for each row execute function public.validate_commercial_policy_publication_v2();

create or replace function public.publish_commercial_policy(
  p_policy_id bigint,
  p_actor_id uuid,
  p_expected_lock_version integer,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy_record public.commercial_policies%rowtype;
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_expected_lock_version is null then
    raise exception using errcode = '22004', message = 'commercial policy publication requires expected_lock_version';
  end if;
  if p_correlation_id is null then
    raise exception using errcode = '22004', message = 'commercial policy publication requires correlation_id';
  end if;
  select * into policy_record
    from public.commercial_policies
   where id = p_policy_id
   for update;
  if not found then raise exception using errcode = 'P0002', message = 'commercial policy does not exist'; end if;
  if policy_record.status not in ('draft', 'needs_review') then
    raise exception using errcode = '55000', message = 'commercial policy is not publishable';
  end if;
  if policy_record.lock_version <> p_expected_lock_version then
    raise exception using errcode = '40001', message = 'stale commercial policy lock_version';
  end if;
  perform public.validate_commercial_policy_for_publication(policy_record.id);
  before_snapshot := to_jsonb(policy_record);
  perform pg_catalog.set_config('app.pricing_commercial_policy_publication_id', policy_record.id::text, true);
  update public.commercial_policies
     set status = 'published',
         reviewed_at = coalesce(reviewed_at, pg_catalog.now()),
         reviewed_by = coalesce(reviewed_by, p_actor_id),
         published_at = pg_catalog.now(),
         published_by = p_actor_id,
         updated_by = p_actor_id
   where id = policy_record.id
  returning * into policy_record;
  after_snapshot := to_jsonb(policy_record);
  perform public.insert_pricing_publish_audit(
    'commercial_policy', policy_record.id, before_snapshot, after_snapshot, p_actor_id, p_correlation_id
  );
  return jsonb_build_object('policy', to_jsonb(policy_record));
end;
$$;

create or replace function public.publish_commercial_offer(
  p_offer_id bigint,
  p_actor_id uuid,
  p_expected_lock_version integer,
  p_correlation_id uuid
)
returns public.commercial_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_record public.commercial_offers%rowtype;
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_expected_lock_version is null then
    raise exception using errcode = '22004', message = 'commercial offer publication requires expected_lock_version';
  end if;
  if p_correlation_id is null then
    raise exception using errcode = '22004', message = 'commercial offer publication requires correlation_id';
  end if;
  select * into offer_record
    from public.commercial_offers
   where id = p_offer_id
   for update;
  if not found then raise exception using errcode = 'P0002', message = 'commercial offer does not exist'; end if;
  if offer_record.status <> 'draft' then
    raise exception using errcode = '55000', message = 'commercial offer is not draft';
  end if;
  if offer_record.lock_version <> p_expected_lock_version then
    raise exception using errcode = '40001', message = 'stale commercial offer lock_version';
  end if;
  perform 1
    from public.commercial_offer_policies as membership
    join public.commercial_policies as policy on policy.id = membership.commercial_policy_id
   where membership.commercial_offer_id = offer_record.id
   order by policy.id
   for key share of policy;
  perform public.assert_commercial_offer_publishable(offer_record.id);
  before_snapshot := jsonb_build_object(
    'offer', to_jsonb(offer_record),
    'policyIds', (
      select jsonb_agg(membership.commercial_policy_id order by membership.commercial_policy_id)
        from public.commercial_offer_policies as membership
       where membership.commercial_offer_id = offer_record.id
    )
  );
  perform pg_catalog.set_config('app.pricing_commercial_offer_publication_id', offer_record.id::text, true);
  update public.commercial_offers
     set status = 'published',
         published_at = pg_catalog.now(),
         published_by = p_actor_id,
         updated_by = p_actor_id
   where id = offer_record.id
  returning * into offer_record;
  after_snapshot := jsonb_build_object(
    'offer', to_jsonb(offer_record),
    'policyIds', (
      select jsonb_agg(membership.commercial_policy_id order by membership.commercial_policy_id)
        from public.commercial_offer_policies as membership
       where membership.commercial_offer_id = offer_record.id
    )
  );
  perform public.insert_pricing_publish_audit(
    'commercial_offer', offer_record.id, before_snapshot, after_snapshot, p_actor_id, p_correlation_id
  );
  return offer_record;
end;
$$;

create or replace function public.link_commercial_offer_policy(
  p_offer_id bigint,
  p_policy_id bigint,
  p_actor_id uuid,
  p_expected_offer_lock_version integer,
  p_correlation_id uuid
)
returns public.commercial_offer_policies
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_record public.commercial_offers%rowtype;
  membership_record public.commercial_offer_policies%rowtype;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_expected_offer_lock_version is null or p_correlation_id is null then
    raise exception using errcode = '22004', message = 'membership link requires expected lock version and correlation_id';
  end if;
  select * into offer_record from public.commercial_offers where id = p_offer_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'commercial offer does not exist'; end if;
  if offer_record.lock_version <> p_expected_offer_lock_version then
    raise exception using errcode = '40001', message = 'stale commercial offer lock_version';
  end if;
  insert into public.commercial_offer_policies (
    commercial_offer_id, commercial_policy_id, created_by
  ) values (p_offer_id, p_policy_id, p_actor_id)
  returning * into membership_record;
  update public.commercial_offers set updated_by = p_actor_id where id = p_offer_id;
  insert into public.pricing_audit_events (
    aggregate_type, aggregate_id, action, after_snapshot, actor_id, correlation_id
  ) values (
    'commercial_offer', p_offer_id, 'link', to_jsonb(membership_record), p_actor_id, p_correlation_id
  );
  return membership_record;
end;
$$;

create or replace function public.unlink_commercial_offer_policy(
  p_offer_id bigint,
  p_policy_id bigint,
  p_actor_id uuid,
  p_expected_offer_lock_version integer,
  p_correlation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_record public.commercial_offers%rowtype;
  membership_record public.commercial_offer_policies%rowtype;
begin
  perform public.assert_active_pricing_admin(p_actor_id);
  if p_expected_offer_lock_version is null or p_correlation_id is null then
    raise exception using errcode = '22004', message = 'membership unlink requires expected lock version and correlation_id';
  end if;
  select * into offer_record from public.commercial_offers where id = p_offer_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'commercial offer does not exist'; end if;
  if offer_record.lock_version <> p_expected_offer_lock_version then
    raise exception using errcode = '40001', message = 'stale commercial offer lock_version';
  end if;
  delete from public.commercial_offer_policies
   where commercial_offer_id = p_offer_id and commercial_policy_id = p_policy_id
  returning * into membership_record;
  if not found then return false; end if;
  update public.commercial_offers set updated_by = p_actor_id where id = p_offer_id;
  insert into public.pricing_audit_events (
    aggregate_type, aggregate_id, action, before_snapshot, actor_id, correlation_id
  ) values (
    'commercial_offer', p_offer_id, 'unlink', to_jsonb(membership_record), p_actor_id, p_correlation_id
  );
  return true;
end;
$$;

drop trigger if exists commercial_offers_set_pricing_updated_at on public.commercial_offers;
create trigger commercial_offers_set_pricing_updated_at
before update on public.commercial_offers
for each row execute function public.set_pricing_updated_at();

create or replace function public.prevent_terminal_product_public_price_v2_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status in ('published', 'archived') and (
    new.ends_on is distinct from old.ends_on
    or new.price_type is distinct from old.price_type
    or new.source_reference is distinct from old.source_reference
    or new.legacy_source_id is distinct from old.legacy_source_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'published or archived product public price V2 identity is immutable';
  end if;
  return new;
end;
$$;

create trigger product_public_prices_prevent_terminal_v2_change
before update on public.product_public_prices
for each row execute function public.prevent_terminal_product_public_price_v2_change();

alter function public.validate_commercial_offer_policy_membership() owner to postgres;
alter function public.validate_commercial_policy_for_publication(bigint) owner to postgres;
alter function public.validate_commercial_policy_for_offer(bigint, bigint) owner to postgres;
alter function public.assert_commercial_offer_publishable(bigint) owner to postgres;
alter function public.validate_commercial_policy_publication_v2() owner to postgres;
alter function public.publish_commercial_policy(bigint, uuid, integer, uuid) owner to postgres;
alter function public.publish_commercial_offer(bigint, uuid, integer, uuid) owner to postgres;
alter function public.link_commercial_offer_policy(bigint, bigint, uuid, integer, uuid) owner to postgres;
alter function public.unlink_commercial_offer_policy(bigint, bigint, uuid, integer, uuid) owner to postgres;
alter function public.prevent_terminal_product_public_price_v2_change() owner to postgres;

revoke all on function public.validate_commercial_offer_policy_membership() from public, anon, authenticated, service_role;
revoke all on function public.validate_commercial_policy_for_publication(bigint) from public, anon, authenticated, service_role;
revoke all on function public.validate_commercial_policy_for_offer(bigint, bigint) from public, anon, authenticated, service_role;
revoke all on function public.assert_commercial_offer_publishable(bigint) from public, anon, authenticated, service_role;
revoke all on function public.validate_commercial_policy_publication_v2() from public, anon, authenticated, service_role;
revoke all on function public.prevent_terminal_product_public_price_v2_change() from public, anon, authenticated, service_role;
revoke all on function public.publish_commercial_policy(bigint, uuid, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function public.publish_commercial_offer(bigint, uuid, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function public.link_commercial_offer_policy(bigint, bigint, uuid, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function public.unlink_commercial_offer_policy(bigint, bigint, uuid, integer, uuid) from public, anon, authenticated, service_role;
grant execute on function public.publish_commercial_policy(bigint, uuid, integer, uuid) to service_role;
grant execute on function public.publish_commercial_offer(bigint, uuid, integer, uuid) to service_role;
grant execute on function public.link_commercial_offer_policy(bigint, bigint, uuid, integer, uuid) to service_role;
grant execute on function public.unlink_commercial_offer_policy(bigint, bigint, uuid, integer, uuid) to service_role;

comment on table public.commercial_offer_policies is
  'Immutable membership of published commercial offers; an offer is the only valid benefit combination.';
comment on column public.commercial_policies.product_id is
  'Exactly one product owns each commercial policy in Pricing Domain V2.';
