import type { PricingWorkflowStatus } from './product-public-price';

export const COMMERCIAL_POLICY_TYPES = [
  'retail_bonus',
  'invoice_discount',
  'trade_in_bonus',
  'loyalty_bonus',
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
  'invoice_discount',
  'trade_in_bonus',
  'loyalty_bonus',
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

export interface CommercialPolicy {
  readonly id: string;
  readonly productId: string;
  readonly policyType: CommercialPolicyType;
  readonly title: string;
  readonly description: string | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly customerBenefitAmount: string;
  readonly dealerRebateAmount?: string | null;
  readonly status: PricingWorkflowStatus;
  readonly lockVersion: number;
}

export interface CommercialOfferPolicyMembership {
  readonly commercialOfferId: string;
  readonly commercialPolicyId: string;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface CommercialOffer {
  readonly id: string;
  readonly productId: string;
  readonly publicPriceId: string | null;
  readonly publicPriceAmount: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly status: 'draft' | 'published' | 'archived';
  readonly policyIds: readonly string[];
  readonly lockVersion: number;
}

interface CommercialPolicyInputBase {
  readonly productId: string;
  readonly title: string;
  readonly description?: string;
  readonly startsOn: string;
  readonly endsOn?: string | null;
}

interface FixedAmountPolicyInput extends CommercialPolicyInputBase {
  readonly amount: string;
}

export interface RetailBonusPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'retail_bonus';
}

export interface InvoiceDiscountPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'invoice_discount';
}

export interface TradeInBonusPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'trade_in_bonus';
}

export interface LoyaltyBonusPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'loyalty_bonus';
}

export interface FreeWallboxPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'free_wallbox';
}

export interface FreeMaintenancePolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'free_maintenance';
  readonly maintenanceCount?: number;
  readonly coverageMonths?: number;
  readonly coverageKm?: string;
}

export interface OtherPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'other';
  readonly description: string;
}

export interface VoucherPolicyInput extends FixedAmountPolicyInput {
  readonly policyType: 'fuel_or_recharge_voucher';
  readonly voucherType: PricingVoucherType;
}

export interface FreeIpvaPolicyInput extends CommercialPolicyInputBase {
  readonly policyType: 'free_ipva';
  readonly annualRate: string;
  readonly offerMonth: number;
  readonly remainingMonths: number;
  readonly calculationBasePriceId: string;
  readonly customerBenefitAmount: string;
}

export interface FreeInsurancePolicyInput extends CommercialPolicyInputBase {
  readonly policyType: 'free_insurance';
  readonly annualRate: string;
  readonly coverageYears: string;
  readonly calculationBasePriceId: string;
  readonly customerBenefitAmount: string;
}

export interface SubsidizedFinancingPolicyInput extends CommercialPolicyInputBase {
  readonly policyType: 'subsidized_financing';
  readonly termMonths: number;
  readonly customerInterestRateMonthly: string;
  readonly downPaymentPercentage: string;
  readonly financedPrincipal: string;
  readonly calculationBasePriceId: string;
  readonly financialParameterSetId: string;
  readonly customerBenefitAmount: string;
}

export interface FreeRegistrationPolicyInput extends CommercialPolicyInputBase {
  readonly policyType: 'free_registration';
  readonly calculationBasePriceId: string;
  readonly basePriceAmount: string;
}

export type CommercialPolicyInput =
  | RetailBonusPolicyInput
  | InvoiceDiscountPolicyInput
  | TradeInBonusPolicyInput
  | LoyaltyBonusPolicyInput
  | SubsidizedFinancingPolicyInput
  | FreeIpvaPolicyInput
  | FreeInsurancePolicyInput
  | FreeWallboxPolicyInput
  | FreeRegistrationPolicyInput
  | FreeMaintenancePolicyInput
  | VoucherPolicyInput
  | OtherPolicyInput;
