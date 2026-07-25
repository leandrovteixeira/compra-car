create view public.vw_product_public_price_periods
with (security_invoker = true)
as
with published_prices as (
  select
    price.id,
    price.product_id,
    price.amount,
    price.currency_code,
    price.starts_on,
    lead(price.starts_on) over (
      partition by price.product_id
      order by price.starts_on, price.id
    ) as next_starts_on,
    price.published_at
  from public.product_public_prices as price
  where price.status = 'published'
)
select
  published_price.id,
  published_price.product_id,
  published_price.amount,
  published_price.currency_code,
  published_price.starts_on,
  published_price.next_starts_on,
  published_price.next_starts_on - 1 as ends_on,
  published_price.published_at
from published_prices as published_price;

alter view public.vw_product_public_price_periods owner to postgres;
revoke all on table public.vw_product_public_price_periods
  from public, anon, authenticated, service_role;
grant select on table public.vw_product_public_price_periods to service_role;

create view public.vw_current_product_public_prices
with (security_invoker = true)
as
select
  period.id,
  period.product_id,
  period.amount,
  period.currency_code,
  period.starts_on,
  period.next_starts_on,
  period.ends_on,
  period.published_at
from public.vw_product_public_price_periods as period
where period.starts_on <= current_date
  and (period.ends_on is null or period.ends_on >= current_date);

alter view public.vw_current_product_public_prices owner to postgres;
revoke all on table public.vw_current_product_public_prices
  from public, anon, authenticated, service_role;
grant select on table public.vw_current_product_public_prices to service_role;

create view public.vw_published_commercial_policy_applications
with (security_invoker = true)
as
select
  policy.id as policy_id,
  policy.policy_type,
  policy.scope_type,
  policy.title,
  policy.description,
  policy.starts_on,
  policy.ends_on,
  application.product_id,
  application.monetary_value,
  application.currency_code,
  policy.calculation_method,
  application.basis_public_price_id
from public.commercial_policies as policy
join public.commercial_policy_applications as application
  on application.policy_id = policy.id
join public.products as product
  on product.id = application.product_id
where policy.status = 'published'
  and policy.starts_on <= current_date
  and (policy.ends_on is null or policy.ends_on >= current_date);

alter view public.vw_published_commercial_policy_applications owner to postgres;
revoke all on table public.vw_published_commercial_policy_applications
  from public, anon, authenticated, service_role;
grant select on table public.vw_published_commercial_policy_applications to service_role;

create view public.vw_published_commercial_policy_accumulators
with (security_invoker = true)
as
with accumulator_members as (
  select
    item.accumulator_id,
    array_agg(policy.id order by policy.id)::bigint[] as member_policy_ids
  from public.commercial_policy_accumulator_items as item
  join public.commercial_policies as policy
    on policy.id = item.policy_id
  group by item.accumulator_id
)
select
  accumulator.id as accumulator_id,
  accumulator.title,
  accumulator.description,
  accumulator.starts_on,
  accumulator.ends_on,
  accumulator.combination_fingerprint,
  value.product_id,
  value.monetary_value,
  value.currency_code,
  member.member_policy_ids
from public.commercial_policy_accumulators as accumulator
join public.commercial_policy_accumulator_values as value
  on value.accumulator_id = accumulator.id
join accumulator_members as member
  on member.accumulator_id = accumulator.id
where accumulator.status = 'published'
  and accumulator.starts_on <= current_date
  and (accumulator.ends_on is null or accumulator.ends_on >= current_date);

alter view public.vw_published_commercial_policy_accumulators owner to postgres;
revoke all on table public.vw_published_commercial_policy_accumulators
  from public, anon, authenticated, service_role;
grant select on table public.vw_published_commercial_policy_accumulators to service_role;

create view public.vw_product_value_current_v2
with (security_invoker = true)
as
select
  product.id as product_id,
  concat(
    product.brand,
    ' ',
    product.model,
    ' ',
    product.version,
    ' MY',
    product.model_year
  ) as product_name,
  product.brand,
  product.model,
  product.version,
  product.model_year,
  current_price.amount as public_price,
  round(
    sum(
      case
        when spec.type::text = 'numeric'::text then
          coalesce(product_spec.value, 0::numeric)
          * coalesce(spec.unit_perceived_value, 0::numeric)
        else coalesce(spec.relative_value, 0::numeric)
      end
    ),
    0
  ) as perceived_value_total
from public.products as product
join public.product_specs as product_spec
  on product_spec.product_id = product.id
join public.specs as spec
  on spec.id = product_spec.equipment_id
join public.vw_current_product_public_prices as current_price
  on current_price.product_id = product.id
where product.is_active = true
  and spec.is_active = true
group by
  product.id,
  product.brand,
  product.model,
  product.version,
  product.model_year,
  current_price.amount;

alter view public.vw_product_value_current_v2 owner to postgres;
revoke all on table public.vw_product_value_current_v2
  from public, anon, authenticated, service_role;
grant select on table public.vw_product_value_current_v2 to service_role;
