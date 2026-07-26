export const COMMERCIAL_POLICY_TYPES = [
  'retail_bonus',
  'trade_in_bonus',
  'subsidized_financing',
  'free_ipva',
  'free_insurance',
  'free_wallbox',
  'registration',
  'other',
  'free_registration',
  'free_maintenance',
  'fuel_or_recharge_voucher',
] as const;

export type CommercialPolicyType = (typeof COMMERCIAL_POLICY_TYPES)[number];

export const CURRENT_COMMERCIAL_POLICY_TYPES = [
  'retail_bonus',
  'trade_in_bonus',
  'subsidized_financing',
  'free_ipva',
  'free_insurance',
  'free_wallbox',
  'free_registration',
  'free_maintenance',
  'fuel_or_recharge_voucher',
  'other',
] as const satisfies readonly CommercialPolicyType[];

export const DEPRECATED_COMMERCIAL_POLICY_TYPES = [
  'registration',
] as const satisfies readonly CommercialPolicyType[];

export const POLICY_CALCULATION_METHODS = [
  'fixed_amount',
  'percentage_of_msrp',
  'present_value_subsidy',
  'manual_amount',
  'proportional_ipva',
  'discounted_promotional_cash_flow_difference',
  'non_monetized',
] as const;

export type PolicyCalculationMethod = (typeof POLICY_CALCULATION_METHODS)[number];

export const DEPRECATED_POLICY_CALCULATION_METHODS = [
  'present_value_subsidy',
] as const satisfies readonly PolicyCalculationMethod[];

export const DEALER_REBATE_ELIGIBLE_POLICY_TYPES = [
  'retail_bonus',
  'trade_in_bonus',
  'subsidized_financing',
] as const satisfies readonly CommercialPolicyType[];

export const PRICING_VOUCHER_TYPES = ['fuel', 'electric_recharge', 'unspecified'] as const;

export type PricingVoucherType = (typeof PRICING_VOUCHER_TYPES)[number];
