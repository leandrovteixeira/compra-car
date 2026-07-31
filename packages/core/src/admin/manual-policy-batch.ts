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
  readonly calculationBasePriceId?: string;
  readonly basePriceAmount?: string;
  readonly financialParameterSetId?: string;
  readonly monthlyReferenceRate?: string;
  readonly basePriceResolution?: 'missing' | 'ambiguous';
  readonly financialReferenceResolution?: 'missing' | 'ambiguous';
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
  'loyalty_bonus',
  'free_wallbox',
  'free_maintenance',
  'fuel_or_recharge_voucher',
  'other',
]);
export const MANUAL_POLICY_TITLES: Readonly<Record<string, string>> = Object.freeze({
  retail_bonus: 'Bônus varejo',
  trade_in_bonus: 'Bônus trade-in',
  loyalty_bonus: 'Loyalty',
  subsidized_financing: 'Financiamento subsidiado',
  free_ipva: 'IPVA grátis',
  free_insurance: 'Seguro grátis',
  free_wallbox: 'Wallbox grátis',
  free_registration: 'Emplacamento grátis',
  free_maintenance: 'Manutenção grátis',
  fuel_or_recharge_voucher: 'Voucher combustível/recarga',
  other: 'Outro benefício',
});
export const MANUAL_POLICY_DISPLAY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ...MANUAL_POLICY_TITLES,
  subsidized_financing: 'Taxa',
  fuel_or_recharge_voucher: 'Voucher',
});
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const PT_BR_DECIMAL = /^(?:0|[1-9]\d*)(?:[.,]\d+)?$/u;
const integer = (value?: string) => Boolean(value && /^[1-9]\d*$/u.test(value));
const positive = (value?: string) =>
  Boolean(value && DECIMAL.test(value) && new Decimal(value).gt(0));
const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

export function canonicalManualPolicyPercentage(value?: string): string | undefined {
  const compact = value?.trim();
  return compact && PT_BR_DECIMAL.test(compact) ? compact.replace(',', '.') : undefined;
}

export function formatPtBrPercentageInput(value: string): string {
  const compact = value.trim();
  if (!compact) return '';
  return /^(?:0|[1-9]\d*)(?:[.,]\d*)?$/u.test(compact) ? compact.replace('.', ',') : value;
}

export function normalizeManualPolicyBatchRow(
  row: ManualPolicyBatchRowInput,
): ManualPolicyBatchRowInput {
  const common = {
    clientRowId: row.clientRowId,
    productId: row.productId,
    policyType: row.policyType,
    title: MANUAL_POLICY_TITLES[row.policyType] ?? '',
    description: row.description,
    startsOn: row.startsOn,
    endsOn: null,
  };
  if (FIXED.has(row.policyType)) {
    return {
      ...common,
      amount: canonicalManualPriceAmount(row.amount ?? '') ?? row.amount,
      voucherType:
        row.policyType === 'fuel_or_recharge_voucher'
          ? row.voucherType || 'unspecified'
          : undefined,
    };
  }
  if (row.policyType === 'free_insurance') {
    const months = row.termMonths || '12';
    return {
      ...common,
      annualRate: '0.03',
      termMonths: months,
      coverageYears: /^(?:12|24|36)$/u.test(months) ? String(Number(months) / 12) : '',
    };
  }
  if (row.policyType === 'free_ipva') {
    const month = /^\d{4}-(\d{2})-\d{2}$/u.exec(row.startsOn)?.[1];
    return {
      ...common,
      annualRate: '0.04',
      offerMonth: month ? String(Number(month)) : '',
    };
  }
  if (row.policyType === 'subsidized_financing') {
    return {
      ...common,
      termMonths: row.termMonths,
      customerInterestRateMonthly: canonicalManualPolicyPercentage(row.customerInterestRateMonthly),
      downPaymentPercentage: canonicalManualPolicyPercentage(row.downPaymentPercentage),
    };
  }
  return common;
}

export function resolveManualPolicyReferenceData(
  row: Pick<ManualPolicyBatchRowInput, 'productId' | 'startsOn'>,
  prices: readonly {
    readonly id: string;
    readonly productId: string;
    readonly amount: string;
    readonly startsOn: string;
    readonly endsOn: string | null;
  }[],
  references: readonly {
    readonly id: string;
    readonly effectiveFrom: string;
    readonly validTo: string | null;
    readonly monthlyReferenceRate: string;
  }[],
): ManualPolicyReferenceData {
  const matchingPrices = prices.filter(
    (price) =>
      price.productId === row.productId &&
      price.startsOn <= row.startsOn &&
      (price.endsOn === null || price.endsOn >= row.startsOn),
  );
  const matchingReferences = references.filter(
    (reference) =>
      reference.effectiveFrom <= row.startsOn &&
      (reference.validTo === null || reference.validTo >= row.startsOn),
  );
  const price = matchingPrices.length === 1 ? matchingPrices[0] : undefined;
  const reference = matchingReferences.length === 1 ? matchingReferences[0] : undefined;
  return {
    calculationBasePriceId: price?.id,
    basePriceAmount: price?.amount,
    financialParameterSetId: reference?.id,
    monthlyReferenceRate: reference?.monthlyReferenceRate,
    basePriceResolution:
      matchingPrices.length === 0 ? 'missing' : matchingPrices.length > 1 ? 'ambiguous' : undefined,
    financialReferenceResolution:
      matchingReferences.length === 0
        ? 'missing'
        : matchingReferences.length > 1
          ? 'ambiguous'
          : undefined,
  };
}

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
  if (row.policyType === 'free_ipva' && integer(row.offerMonth)) {
    const remainingMonths = 13 - Number(row.offerMonth);
    return {
      customerBenefitAmount: money(base.mul('0.04').mul(remainingMonths).div(12)),
      remainingMonths,
    };
  }
  if (row.policyType === 'free_insurance' && positive(row.coverageYears)) {
    return { customerBenefitAmount: money(base.mul('0.03').mul(row.coverageYears!)) };
  }
  if (
    row.policyType === 'subsidized_financing' &&
    integer(row.termMonths) &&
    Boolean(row.customerInterestRateMonthly?.match(DECIMAL)) &&
    Boolean(row.downPaymentPercentage?.match(DECIMAL)) &&
    reference.monthlyReferenceRate &&
    reference.financialParameterSetId
  ) {
    const down = new Decimal(row.downPaymentPercentage!);
    const customerRate = new Decimal(row.customerInterestRateMonthly!).div(100);
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
  const candidates = rows.filter((row) =>
    Object.entries(row).some(
      ([field, value]) => field !== 'clientRowId' && value != null && String(value).trim() !== '',
    ),
  );
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
    if (row.policyType === 'free_ipva' && (!integer(row.offerMonth) || Number(row.offerMonth) > 12))
      issues.push({
        clientRowId: row.clientRowId,
        field: 'annualRate',
        message: 'Alíquota de IPVA inválida.',
      });
    if (
      row.policyType === 'free_insurance' &&
      (!/^(?:12|24|36)$/u.test(row.termMonths ?? '') || !positive(row.coverageYears))
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
    const reference = references[row.clientRowId] ?? {};
    const needsBasePrice = [
      'free_registration',
      'free_ipva',
      'free_insurance',
      'subsidized_financing',
    ].includes(row.policyType);
    if (needsBasePrice && reference.basePriceResolution) {
      issues.push({
        clientRowId: row.clientRowId,
        field: 'amount',
        message:
          reference.basePriceResolution === 'missing'
            ? 'Não há preço público válido para o veículo na data informada.'
            : 'Há mais de um preço público válido para o veículo na data informada.',
      });
    }
    if (row.policyType === 'subsidized_financing' && reference.financialReferenceResolution) {
      issues.push({
        clientRowId: row.clientRowId,
        field: 'amount',
        message:
          reference.financialReferenceResolution === 'missing'
            ? 'Referência financeira não disponível para a data informada.'
            : 'Há mais de uma referência financeira válida para a data informada.',
      });
    }
    const calculated = calculateManualPolicyBenefit(row, reference);
    if (
      !calculated?.customerBenefitAmount &&
      !reference.basePriceResolution &&
      !reference.financialReferenceResolution
    )
      issues.push({
        clientRowId: row.clientRowId,
        field: 'row',
        message: 'Não foi possível calcular o benefício.',
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
        calculationBasePriceId: reference.calculationBasePriceId,
        ...calculated,
        customerBenefitAmount: calculated.customerBenefitAmount,
      });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, rows: normalized };
}
