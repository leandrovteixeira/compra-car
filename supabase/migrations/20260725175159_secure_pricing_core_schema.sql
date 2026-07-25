alter table public.product_public_prices enable row level security;
alter table public.financial_parameter_sets enable row level security;
alter table public.commercial_policies enable row level security;
alter table public.commercial_policy_applications enable row level security;
alter table public.commercial_policy_accumulators enable row level security;
alter table public.commercial_policy_accumulator_items enable row level security;
alter table public.commercial_policy_accumulator_values enable row level security;

revoke all privileges on table
  public.product_public_prices,
  public.financial_parameter_sets,
  public.commercial_policies,
  public.commercial_policy_applications,
  public.commercial_policy_accumulators,
  public.commercial_policy_accumulator_items,
  public.commercial_policy_accumulator_values
from public, anon, authenticated, service_role;

revoke all privileges on sequence
  public.product_public_prices_id_seq,
  public.financial_parameter_sets_id_seq,
  public.commercial_policies_id_seq,
  public.commercial_policy_applications_id_seq,
  public.commercial_policy_accumulators_id_seq,
  public.commercial_policy_accumulator_values_id_seq
from public, anon, authenticated, service_role;

grant select, insert, update on table
  public.product_public_prices,
  public.financial_parameter_sets,
  public.commercial_policies,
  public.commercial_policy_applications,
  public.commercial_policy_accumulators,
  public.commercial_policy_accumulator_items,
  public.commercial_policy_accumulator_values
to service_role;

grant usage, select on sequence
  public.product_public_prices_id_seq,
  public.financial_parameter_sets_id_seq,
  public.commercial_policies_id_seq,
  public.commercial_policy_applications_id_seq,
  public.commercial_policy_accumulators_id_seq,
  public.commercial_policy_accumulator_values_id_seq
to service_role;
