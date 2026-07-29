import Decimal from 'decimal.js';

import {
  CURRENT_COMMERCIAL_POLICY_TYPES,
  PRICING_VOUCHER_TYPES,
} from '../entities/commercial-pricing';
import { canonicalManualPriceAmount, isValidManualPriceDate } from './manual-price-batch';

export const MANUAL_POLICY_BATCH_MAX_ROWS = 100;

export interface ManualPolicyBatchRowInput {
  readonly clientRowId: string;
  readonly productId: string;
  readonly policyType: string;
  readonly title: string;
  readonly description: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly amount?: string;
  readonly maintenanceCount?: string;
  readonly coverageMonths?: string;
  readonly coverageKm?: string;
  readonly voucherType?: string;
  readonly calculationBasePriceId?: string;
  readonly annualRate?: string;
  readonly offerMonth?: string;
  readonly coverageYears?: string;
  readonly termMonths?: string;
  readonly customerInterestRateMonthly?: string;
  readonly downPaymentPercentage?: string;
}

export interface ManualPolicyReferenceData {
  readonly basePriceAmount?: string;
  readonly financialParameterSetId?: string;
  readonly monthlyReferenceRate?: string;
}

export interface NormalizedManualPolicyBatchRow extends ManualPolicyBatchRowInput {
  readonly customerBenefitAmount: string;
  readonly financedPrincipal?: string;
  readonly remainingMonths?: number;
  readonly financialParameterSetId?: string;
}

export interface ManualPolicyBatchIssue {
  readonly clientRowId: string;
  readonly field: string;
  readonly message: string;
}

const FIXED = new Set([
  'retail_bonus',
  'trade_in_bonus',
  'free_wallbox',
  'free_maintenance',
  'fuel_or_recharge_voucher',
  'other',
]);
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const integer = (value?: string) => Boolean(value && /^[1-9]\d*$/u.test(value));
const positive = (value?: string) =>
  Boolean(value && DECIMAL.test(value) && new Decimal(value).gt(0));
const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

export function calculateManualPolicyBenefit(
  row: ManualPolicyBatchRowInput,
  reference: ManualPolicyReferenceData,
) {
  if (FIXED.has(row.policyType))
    return { customerBenefitAmount: canonicalManualPriceAmount(row.amount ?? '') };
  if (!reference.basePriceAmount) return null;
  const base = new Decimal(reference.basePriceAmount);
  if (row.policyType === 'free_registration')
    return { customerBenefitAmount: money(base.mul('0.01')) };
  if (row.policyType === 'free_ipva' && positive(row.annualRate) && integer(row.offerMonth)) {
    const remainingMonths = 13 - Number(row.offerMonth);
    return {
      customerBenefitAmount: money(base.mul(row.annualRate!).mul(remainingMonths).div(12)),
      remainingMonths,
    };
  }
  if (
    row.policyType === 'free_insurance' &&
    positive(row.annualRate) &&
    positive(row.coverageYears)
  ) {
    return { customerBenefitAmount: money(base.mul(row.annualRate!).mul(row.coverageYears!)) };
  }
  if (
    row.policyType === 'subsidized_financing' &&
    integer(row.termMonths) &&
    row.customerInterestRateMonthly !== undefined &&
    row.downPaymentPercentage !== undefined &&
    reference.monthlyReferenceRate &&
    reference.financialParameterSetId
  ) {
    const down = new Decimal(row.downPaymentPercentage);
    const customerRate = new Decimal(row.customerInterestRateMonthly).div(100);
    const referenceRate = new Decimal(reference.monthlyReferenceRate);
    const term = Number(row.termMonths);
    const principal = base
      .mul(new Decimal(1).minus(down.div(100)))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const payment = customerRate.isZero()
      ? principal.div(term)
      : principal
          .mul(customerRate)
          .mul(new Decimal(1).plus(customerRate).pow(term))
          .div(new Decimal(1).plus(customerRate).pow(term).minus(1));
    const pv = referenceRate.isZero()
      ? payment.mul(term)
      : payment
          .mul(new Decimal(1).minus(new Decimal(1).plus(referenceRate).pow(-term)))
          .div(referenceRate);
    const benefit = principal.minus(pv);
    if (!benefit.gt(0)) return null;
    return {
      customerBenefitAmount: money(benefit),
      financedPrincipal: money(principal),
      financialParameterSetId: reference.financialParameterSetId,
    };
  }
  return null;
}

export function validateManualPolicyBatch(
  rows: readonly ManualPolicyBatchRowInput[],
  references: Readonly<Record<string, ManualPolicyReferenceData>>,
):
  | { ok: true; rows: readonly NormalizedManualPolicyBatchRow[] }
  | { ok: false; issues: readonly ManualPolicyBatchIssue[] } {
  const candidates = rows.filter((r) => r.productId || r.policyType || r.title || r.startsOn);
  if (!candidates.length)
    return {
      ok: false,
      issues: [{ clientRowId: 'row-1', field: 'row', message: 'Preencha pelo menos uma policy.' }],
    };
  if (candidates.length > MANUAL_POLICY_BATCH_MAX_ROWS)
    return {
      ok: false,
      issues: [
        {
          clientRowId: candidates[100]!.clientRowId,
          field: 'row',
          message: 'O lote aceita no máximo 100 policies.',
        },
      ],
    };
  const issues: ManualPolicyBatchIssue[] = [];
  const normalized: NormalizedManualPolicyBatchRow[] = [];
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  for (const row of candidates) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(row.clientRowId) || ids.has(row.clientRowId))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'row',
        message: 'Identificador local inválido ou repetido.',
      });
    ids.add(row.clientRowId);
    if (!/^\d+$/u.test(row.productId))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'productId',
        message: 'Selecione um veículo válido.',
      });
    if (!CURRENT_COMMERCIAL_POLICY_TYPES.includes(row.policyType as never))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'policyType',
        message: 'Tipo de policy inválido ou descontinuado.',
      });
    if (!row.title.trim())
      issues.push({
        clientRowId: row.clientRowId,
        field: 'title',
        message: 'Título é obrigatório.',
      });
    if (!isValidManualPriceDate(row.startsOn))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'startsOn',
        message: 'Data inicial inválida.',
      });
    if (row.endsOn && (!isValidManualPriceDate(row.endsOn) || row.endsOn < row.startsOn))
      issues.push({ clientRowId: row.clientRowId, field: 'endsOn', message: 'Período inválido.' });
    if (row.policyType === 'other' && !row.description.trim())
      issues.push({
        clientRowId: row.clientRowId,
        field: 'description',
        message: 'Descrição é obrigatória.',
      });
    if (FIXED.has(row.policyType) && !canonicalManualPriceAmount(row.amount ?? ''))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'amount',
        message: 'Informe um benefício BRL positivo.',
      });
    if (
      row.policyType === 'fuel_or_recharge_voucher' &&
      !PRICING_VOUCHER_TYPES.includes(row.voucherType as never)
    )
      issues.push({
        clientRowId: row.clientRowId,
        field: 'voucherType',
        message: 'Tipo de voucher inválido.',
      });
    if (row.policyType === 'free_maintenance')
      for (const field of ['maintenanceCount', 'coverageMonths'] as const)
        if (row[field] && !integer(row[field]))
          issues.push({
            clientRowId: row.clientRowId,
            field,
            message: 'Informe um inteiro positivo.',
          });
    if (
      row.policyType === 'free_ipva' &&
      (!positive(row.annualRate) ||
        new Decimal(row.annualRate || 0).gt(1) ||
        !integer(row.offerMonth) ||
        Number(row.offerMonth) > 12)
    )
      issues.push({
        clientRowId: row.clientRowId,
        field: 'annualRate',
        message: 'Alíquota de IPVA inválida.',
      });
    if (
      row.policyType === 'free_insurance' &&
      (!positive(row.annualRate) ||
        new Decimal(row.annualRate || 0).gt(1) ||
        !positive(row.coverageYears))
    )
      issues.push({
        clientRowId: row.clientRowId,
        field: 'annualRate',
        message: 'Parâmetros de seguro inválidos.',
      });
    if (
      row.policyType === 'subsidized_financing' &&
      (!integer(row.termMonths) ||
        !row.customerInterestRateMonthly?.match(DECIMAL) ||
        !row.downPaymentPercentage?.match(DECIMAL) ||
        new Decimal(row.downPaymentPercentage || 100).gte(100))
    )
      issues.push({
        clientRowId: row.clientRowId,
        field: 'termMonths',
        message: 'Parâmetros de financiamento inválidos.',
      });
    const calculated = calculateManualPolicyBenefit(row, references[row.clientRowId] ?? {});
    if (!calculated?.customerBenefitAmount)
      issues.push({
        clientRowId: row.clientRowId,
        field: 'row',
        message:
          row.policyType === 'subsidized_financing'
            ? 'Referência financeira não disponível.'
            : 'Não foi possível calcular o benefício.',
      });
    const fingerprint = JSON.stringify({ ...row, clientRowId: undefined });
    if (fingerprints.has(fingerprint))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'row',
        message: 'Policy duplicada dentro do lote.',
      });
    fingerprints.add(fingerprint);
    if (calculated?.customerBenefitAmount) {
      normalized.push({
        ...row,
        ...calculated,
        customerBenefitAmount: calculated.customerBenefitAmount,
      });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, rows: normalized };
}
