import {
  CURRENT_COMMERCIAL_POLICY_TYPES,
  PRICING_VOUCHER_TYPES,
  type CommercialPolicyInput,
  type CommercialPolicyType,
} from '../entities/commercial-pricing';
import { isCanonicalMoney, multiplyMoneyByRate } from '../value-objects/money';

export interface CommercialPolicyInputValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly customerBenefitAmount?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const COMMON_FIELDS = new Set([
  'policyType',
  'productId',
  'title',
  'description',
  'startsOn',
  'endsOn',
]);

const TYPE_FIELDS: Readonly<
  Record<Exclude<CommercialPolicyType, 'registration'>, readonly string[]>
> = {
  retail_bonus: ['amount'],
  trade_in_bonus: ['amount'],
  subsidized_financing: [
    'termMonths',
    'customerInterestRateMonthly',
    'downPaymentPercentage',
    'financedPrincipal',
    'calculationBasePriceId',
    'financialParameterSetId',
    'customerBenefitAmount',
  ],
  free_ipva: [
    'annualRate',
    'offerMonth',
    'remainingMonths',
    'calculationBasePriceId',
    'customerBenefitAmount',
  ],
  free_insurance: [
    'annualRate',
    'coverageYears',
    'calculationBasePriceId',
    'customerBenefitAmount',
  ],
  free_wallbox: ['amount'],
  free_registration: ['calculationBasePriceId', 'basePriceAmount'],
  free_maintenance: ['amount', 'maintenanceCount', 'coverageMonths', 'coverageKm'],
  fuel_or_recharge_voucher: ['amount', 'voucherType'],
  other: ['amount'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function positiveDecimal(value: unknown): boolean {
  return typeof value === 'string' && POSITIVE_DECIMAL_PATTERN.test(value) && Number(value) > 0;
}

function requiredString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateCommercialPolicyInput(
  input: unknown,
): CommercialPolicyInputValidationResult {
  if (!isRecord(input)) return { ok: false, errors: ['Policy input must be an object.'] };
  if (
    typeof input.policyType !== 'string' ||
    !CURRENT_COMMERCIAL_POLICY_TYPES.includes(
      input.policyType as (typeof CURRENT_COMMERCIAL_POLICY_TYPES)[number],
    )
  ) {
    return { ok: false, errors: ['Policy type is unsupported or deprecated.'] };
  }

  const policyType = input.policyType as Exclude<CommercialPolicyType, 'registration'>;
  const allowedFields = new Set([...COMMON_FIELDS, ...TYPE_FIELDS[policyType]]);
  const errors: string[] = [];
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field))
      errors.push(`Field ${field} is not applicable to ${policyType}.`);
  }
  if (!requiredString(input.productId)) errors.push('Product is required.');
  if (!requiredString(input.title)) errors.push('Title is required.');
  if (typeof input.startsOn !== 'string' || !DATE_PATTERN.test(input.startsOn)) {
    errors.push('A valid start date is required.');
  }
  if (
    input.endsOn != null &&
    (typeof input.endsOn !== 'string' || !DATE_PATTERN.test(input.endsOn))
  ) {
    errors.push('End date must be null or a valid date.');
  }
  if (
    typeof input.startsOn === 'string' &&
    typeof input.endsOn === 'string' &&
    input.endsOn < input.startsOn
  ) {
    errors.push('End date cannot precede start date.');
  }

  let customerBenefitAmount: string | undefined;
  if (
    policyType === 'retail_bonus' ||
    policyType === 'trade_in_bonus' ||
    policyType === 'free_wallbox' ||
    policyType === 'free_maintenance' ||
    policyType === 'fuel_or_recharge_voucher' ||
    policyType === 'other'
  ) {
    if (!isCanonicalMoney(input.amount) || input.amount === '0.00') {
      errors.push('A positive canonical BRL amount is required.');
    } else {
      customerBenefitAmount = input.amount;
    }
  }
  if (policyType === 'other' && !requiredString(input.description)) {
    errors.push('Description is required for other policies.');
  }
  if (
    policyType === 'fuel_or_recharge_voucher' &&
    !PRICING_VOUCHER_TYPES.includes(input.voucherType as (typeof PRICING_VOUCHER_TYPES)[number])
  ) {
    errors.push('Voucher type is invalid.');
  }
  if (policyType === 'free_maintenance') {
    for (const field of ['maintenanceCount', 'coverageMonths'] as const) {
      if (input[field] !== undefined && !positiveInteger(input[field])) {
        errors.push(`${field} must be a positive integer when provided.`);
      }
    }
    if (input.coverageKm !== undefined && !positiveDecimal(input.coverageKm)) {
      errors.push('coverageKm must be a positive decimal string when provided.');
    }
  }
  if (policyType === 'free_registration') {
    if (!requiredString(input.calculationBasePriceId))
      errors.push('Calculation base price is required.');
    if (!isCanonicalMoney(input.basePriceAmount) || input.basePriceAmount === '0.00') {
      errors.push('A positive canonical base price is required.');
    } else {
      customerBenefitAmount = multiplyMoneyByRate(input.basePriceAmount, '0.01');
    }
  }
  if (policyType === 'free_ipva') {
    if (!positiveDecimal(input.annualRate)) errors.push('Annual rate must be positive.');
    if (!positiveInteger(input.offerMonth) || Number(input.offerMonth) > 12) {
      errors.push('Offer month must be between 1 and 12.');
    }
    if (input.remainingMonths !== 13 - Number(input.offerMonth)) {
      errors.push('Remaining months must equal 13 minus offer month.');
    }
  }
  if (policyType === 'free_insurance') {
    if (!positiveDecimal(input.annualRate)) errors.push('Annual rate must be positive.');
    if (!positiveDecimal(input.coverageYears)) errors.push('Coverage years must be positive.');
  }
  if (policyType === 'subsidized_financing') {
    if (!positiveInteger(input.termMonths)) errors.push('Term must be a positive integer.');
    if (!positiveDecimal(input.financedPrincipal))
      errors.push('Financed principal must be positive.');
    if (!requiredString(input.financialParameterSetId))
      errors.push('Financial parameter set is required.');
  }
  if (
    policyType === 'free_ipva' ||
    policyType === 'free_insurance' ||
    policyType === 'subsidized_financing'
  ) {
    if (!requiredString(input.calculationBasePriceId))
      errors.push('Calculation base price is required.');
    if (!isCanonicalMoney(input.customerBenefitAmount) || input.customerBenefitAmount === '0.00') {
      errors.push('A positive calculated customer benefit is required.');
    } else {
      customerBenefitAmount = input.customerBenefitAmount;
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], customerBenefitAmount };
}

export function asCommercialPolicyInput(input: unknown): CommercialPolicyInput | null {
  return validateCommercialPolicyInput(input).ok ? (input as CommercialPolicyInput) : null;
}
