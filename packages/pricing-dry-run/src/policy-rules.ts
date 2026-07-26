import Decimal from 'decimal.js';

import { decimal, money } from './money.js';
import type {
  CalculationMethod,
  CanonicalRow,
  IssueCode,
  PolicyCandidate,
  PolicyType,
  VoucherType,
} from './types.js';

export const REBATE_ELIGIBLE_POLICY_TYPES = Object.freeze([
  'retail_bonus',
  'trade_in_bonus',
  'subsidized_financing',
] as const satisfies readonly PolicyType[]);

const rebateEligibleSet = new Set<PolicyType>(REBATE_ELIGIBLE_POLICY_TYPES);

export const MONETIZED_POLICY_TYPES = Object.freeze([
  'retail_bonus',
  'trade_in_bonus',
  'subsidized_financing',
  'free_ipva',
  'free_insurance',
  'free_wallbox',
  'free_registration',
  'fuel_or_recharge_voucher',
  'other',
] as const satisfies readonly PolicyType[]);

const monetizedSet = new Set<PolicyType>(MONETIZED_POLICY_TYPES);

export function isRebateEligiblePolicy(type: PolicyType | null): boolean {
  return type !== null && rebateEligibleSet.has(type);
}

export function isMonetizedPolicy(type: PolicyType | null): boolean {
  return type !== null && monetizedSet.has(type);
}

export interface NewPolicyInput {
  policyType:
    'free_wallbox' | 'free_registration' | 'free_maintenance' | 'fuel_or_recharge_voucher';
  publicPrice?: string | null;
  fixedAmount?: string | null;
  voucherType?: VoucherType | null;
  description?: string | null;
  parameters?: CanonicalRow;
}

export interface NewPolicyEvaluation {
  policyType: NewPolicyInput['policyType'];
  calculationMethod: CalculationMethod;
  customerBenefitAmount: string | null;
  fixedAmount: string | null;
  percentageRate: string | null;
  voucherType: VoucherType | null;
  parameters: CanonicalRow;
  issueCodes: IssueCode[];
  publishable: boolean;
  qualitativeBenefit: boolean;
}

const validVoucherTypes = new Set<VoucherType>(['fuel', 'electric_recharge', 'unspecified']);

export function evaluateNewPolicy(input: NewPolicyInput): NewPolicyEvaluation {
  const parameters = input.parameters ?? {};
  if (input.policyType === 'free_wallbox') {
    const amount = decimal(input.fixedAmount ?? '4000');
    const valid = amount?.greaterThan(0) === true;
    return {
      policyType: input.policyType,
      calculationMethod: 'fixed_amount',
      customerBenefitAmount: valid && amount ? money(amount) : null,
      fixedAmount: valid && amount ? money(amount) : null,
      percentageRate: null,
      voucherType: null,
      parameters,
      issueCodes: valid ? [] : ['NEGATIVE_ECONOMIC_VALUE'],
      publishable: valid,
      qualitativeBenefit: true,
    };
  }
  if (input.policyType === 'free_registration') {
    const price = decimal(input.publicPrice ?? null);
    const valid = price?.greaterThan(0) === true;
    return {
      policyType: input.policyType,
      calculationMethod: 'percentage_of_msrp',
      customerBenefitAmount: valid && price ? money(price.mul('0.01')) : null,
      fixedAmount: null,
      percentageRate: '0.010000',
      voucherType: null,
      parameters,
      issueCodes: valid ? [] : ['REGISTRATION_NON_POSITIVE_PUBLIC_PRICE'],
      publishable: valid,
      qualitativeBenefit: true,
    };
  }
  if (input.policyType === 'free_maintenance') {
    const identifiable =
      (input.description ?? '').trim() !== '' ||
      ['maintenance_count', 'coverage_months', 'coverage_km'].some(
        (key) => parameters[key] !== null && parameters[key] !== undefined,
      );
    return {
      policyType: input.policyType,
      calculationMethod: 'non_monetized',
      customerBenefitAmount: null,
      fixedAmount: null,
      percentageRate: null,
      voucherType: null,
      parameters,
      issueCodes: identifiable ? [] : ['MISSING_POLICY_DESCRIPTION'],
      publishable: identifiable,
      qualitativeBenefit: true,
    };
  }

  const amount = decimal(input.fixedAmount ?? null);
  const voucherType = input.voucherType ?? 'unspecified';
  const validAmount = amount?.greaterThan(0) === true;
  const validType = validVoucherTypes.has(voucherType);
  return {
    policyType: input.policyType,
    calculationMethod: 'fixed_amount',
    customerBenefitAmount: validAmount && amount ? money(amount) : null,
    fixedAmount: validAmount && amount ? money(amount) : null,
    percentageRate: null,
    voucherType,
    parameters,
    issueCodes: validAmount && validType ? [] : ['MISSING_INPUT_MONETARY_VALUE'],
    publishable: validAmount && validType,
    qualitativeBenefit: true,
  };
}

export function monetaryPolicyTotal(policies: PolicyCandidate[]): string {
  const total = policies
    .filter(
      (policy) =>
        isMonetizedPolicy(policy.proposedPolicyType) &&
        policy.classification !== 'needs_review' &&
        policy.proposedMonetaryValue !== null,
    )
    .reduce((sum, policy) => sum.plus(policy.proposedMonetaryValue ?? 0), new Decimal(0));
  return money(total);
}
