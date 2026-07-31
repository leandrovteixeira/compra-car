import type { CommercialPolicy } from '../entities/commercial-pricing';
import type { PricingWorkflowStatus } from '../entities/product-public-price';
import { CURRENT_COMMERCIAL_POLICY_TYPES } from '../entities/commercial-pricing';
import { isValidManualPriceDate } from './manual-price-batch';
import {
  calculateCommercialOfferBenefit,
  calculateTransactionalPrice,
} from '../services/commercial-offer-calculator';
import { subtractMoney, sumMoney } from '../value-objects/money';
import type { CommercialPolicyType } from '../entities/commercial-pricing';

export interface CommercialOfferBuilderPrice {
  readonly id: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly status: PricingWorkflowStatus;
}
export interface CreateCommercialOfferDraftInput {
  readonly productId: string;
  readonly publicPriceId: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly policyIds: readonly string[];
}
export interface ValidatedCommercialOfferDraft extends CreateCommercialOfferDraftInput {
  readonly benefitAmount: string;
  readonly transactionalPrice: string;
}
export type CommercialOfferBuilderValidation =
  | { readonly ok: true; readonly value: ValidatedCommercialOfferDraft }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateCommercialOfferDraft(
  input: CreateCommercialOfferDraftInput,
  price: CommercialOfferBuilderPrice | null,
  policies: readonly CommercialPolicy[],
): CommercialOfferBuilderValidation {
  const errors: string[] = [];
  if (!/^\d+$/u.test(input.productId)) errors.push('Selecione um veículo válido.');
  if (
    !isValidManualPriceDate(input.validFrom) ||
    !isValidManualPriceDate(input.validTo) ||
    input.validTo < input.validFrom
  )
    errors.push('Informe uma vigência válida.');
  if (
    !price ||
    price.id !== input.publicPriceId ||
    price.productId !== input.productId ||
    price.status !== 'published' ||
    price.startsOn > input.validFrom ||
    (price.endsOn !== null && price.endsOn < input.validTo)
  )
    errors.push('Selecione um MSRP publicado que cubra toda a vigência.');
  if (input.policyIds.length === 0) errors.push('Selecione pelo menos uma política.');
  if (new Set(input.policyIds).size !== input.policyIds.length)
    errors.push('A mesma política não pode ser selecionada duas vezes.');
  const selected = input.policyIds.map((id) => policies.find((policy) => policy.id === id));
  if (selected.some((policy) => !policy))
    errors.push('Uma política selecionada não está mais disponível.');
  for (const policy of selected) {
    if (!policy) continue;
    if (policy.productId !== input.productId)
      errors.push('Oferta e políticas devem pertencer ao mesmo veículo.');
    if (policy.status === 'rejected' || policy.status === 'archived')
      errors.push(`A política ${policy.title} não pode compor uma nova oferta.`);
    if (!CURRENT_COMMERCIAL_POLICY_TYPES.includes(policy.policyType as never))
      errors.push(`A política ${policy.title} usa tipo descontinuado.`);
    if (
      policy.startsOn > input.validFrom ||
      (policy.endsOn !== null && policy.endsOn < input.validTo)
    )
      errors.push(`A política ${policy.title} não cobre a vigência da oferta.`);
  }
  if (errors.length || !price) return { ok: false, errors };
  try {
    const usable = selected.filter((policy): policy is CommercialPolicy => Boolean(policy));
    const benefitAmount = calculateCommercialOfferBenefit(usable, input.productId);
    const transactionalPrice = calculateTransactionalPrice(price.amount, usable, input.productId);
    return { ok: true, value: { ...input, benefitAmount, transactionalPrice } };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Composição financeira inválida.'],
    };
  }
}

export const POLICY_COMBINATION_MAX_ROWS = 100;

export const POLICY_COMBINATION_COLUMNS = Object.freeze([
  { policyType: 'retail_bonus', label: 'Varejo' },
  { policyType: 'trade_in_bonus', label: 'Trade-In' },
  { policyType: 'loyalty_bonus', label: 'Loyalty' },
  { policyType: 'subsidized_financing', label: 'Taxa' },
  { policyType: 'free_ipva', label: 'IPVA' },
  { policyType: 'free_insurance', label: 'Seguro' },
  { policyType: 'free_wallbox', label: 'Wallbox' },
  { policyType: 'free_registration', label: 'Emplac.' },
  { policyType: 'free_maintenance', label: 'Manut.' },
  { policyType: 'fuel_or_recharge_voucher', label: 'Voucher' },
  { policyType: 'other', label: 'Outro' },
] as const satisfies readonly {
  readonly policyType: Exclude<CommercialPolicyType, 'registration'>;
  readonly label: string;
}[]);

export type PolicyCombinationType = (typeof POLICY_COMBINATION_COLUMNS)[number]['policyType'];

export interface PolicyCombinationPolicy {
  readonly id: string;
  readonly productId: string;
  readonly policyType: CommercialPolicyType;
  readonly title: string;
  readonly description: string | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly customerBenefitAmount: string | null;
  readonly status: PricingWorkflowStatus;
}

export interface PolicyCombinationRowInput {
  readonly clientRowId: string;
  readonly productId: string;
  readonly policyIds: readonly string[];
}

export interface ValidatedPolicyCombinationRow extends PolicyCombinationRowInput {
  readonly publicPriceId: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly benefitAmount: string;
}

export interface PolicyCombinationIssue {
  readonly clientRowId: string;
  readonly message: string;
}

export type PolicyCombinationCell =
  | { readonly state: 'unavailable' }
  | { readonly state: 'available'; readonly policy: PolicyCombinationPolicy }
  | { readonly state: 'conflict'; readonly policies: readonly PolicyCombinationPolicy[] };

const ACTIVE_COMBINATION_TYPES = new Set<CommercialPolicyType>(
  POLICY_COMBINATION_COLUMNS.map((column) => column.policyType),
);

function policyCanCompose(policy: PolicyCombinationPolicy): boolean {
  return (
    ACTIVE_COMBINATION_TYPES.has(policy.policyType) &&
    policy.status !== 'rejected' &&
    policy.status !== 'archived'
  );
}

export function resolvePolicyCombinationCells(
  productId: string,
  policies: readonly PolicyCombinationPolicy[],
): Readonly<Record<PolicyCombinationType, PolicyCombinationCell>> {
  return Object.fromEntries(
    POLICY_COMBINATION_COLUMNS.map(({ policyType }) => {
      const matches = policies.filter(
        (policy) =>
          policy.productId === productId &&
          policy.policyType === policyType &&
          policyCanCompose(policy),
      );
      const cell: PolicyCombinationCell =
        matches.length === 0
          ? { state: 'unavailable' }
          : matches.length === 1
            ? { state: 'available', policy: matches[0]! }
            : { state: 'conflict', policies: Object.freeze(matches) };
      return [policyType, cell];
    }),
  ) as Readonly<Record<PolicyCombinationType, PolicyCombinationCell>>;
}

export function calculatePolicyCombinationTotal(
  policies: readonly Pick<PolicyCombinationPolicy, 'customerBenefitAmount'>[],
): string {
  return sumMoney(
    policies.flatMap((policy) =>
      policy.customerBenefitAmount === null ? [] : [policy.customerBenefitAmount],
    ),
  );
}

function derivePolicyCombinationRow(
  row: PolicyCombinationRowInput,
  prices: readonly CommercialOfferBuilderPrice[],
  policies: readonly PolicyCombinationPolicy[],
): { readonly value?: ValidatedPolicyCombinationRow; readonly errors: readonly string[] } {
  const errors: string[] = [];
  if (!/^\d+$/u.test(row.productId)) errors.push('Selecione um veículo válido.');
  if (row.policyIds.length === 0) errors.push('Selecione pelo menos uma política.');
  if (new Set(row.policyIds).size !== row.policyIds.length)
    errors.push('A mesma política não pode ser selecionada duas vezes.');
  const selected = row.policyIds.map((id) => policies.find((policy) => policy.id === id));
  if (selected.some((policy) => !policy))
    errors.push('Uma política selecionada não está mais disponível.');
  const usable = selected.filter((policy): policy is PolicyCombinationPolicy => Boolean(policy));
  if (usable.some((policy) => policy.productId !== row.productId))
    errors.push('Combinação e políticas devem pertencer ao mesmo veículo.');
  if (usable.some((policy) => !policyCanCompose(policy)))
    errors.push('Uma política selecionada usa tipo ou status não combinável.');
  const types = usable.map((policy) => policy.policyType);
  if (new Set(types).size !== types.length)
    errors.push('Existe mais de uma política do mesmo tipo na combinação.');
  if (errors.length || usable.length === 0) return { errors };

  const validFrom = usable
    .map((policy) => policy.startsOn)
    .sort()
    .at(-1)!;
  const matchingPrices = prices.filter(
    (price) =>
      price.productId === row.productId &&
      price.status === 'published' &&
      price.startsOn <= validFrom &&
      (price.endsOn === null || price.endsOn >= validFrom),
  );
  if (matchingPrices.length === 0)
    return { errors: ['Nenhum MSRP publicado é compatível com o início derivado.'] };
  if (matchingPrices.length > 1)
    return { errors: ['Mais de um MSRP publicado é compatível com o início derivado.'] };
  const price = matchingPrices[0]!;
  const endDates = [...usable.flatMap((policy) => (policy.endsOn ? [policy.endsOn] : []))];
  if (price.endsOn) endDates.push(price.endsOn);
  if (endDates.length === 0) {
    return {
      errors: [
        'Não foi possível derivar uma vigência final concreta: as políticas e o preço público selecionado não possuem data final.',
      ],
    };
  }
  const validTo = endDates.sort()[0]!;
  if (validTo < validFrom)
    return { errors: ['As políticas selecionadas não possuem interseção temporal válida.'] };
  const benefitAmount = calculatePolicyCombinationTotal(usable);
  try {
    subtractMoney(price.amount, benefitAmount);
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'O benefício excede o MSRP resolvido.'],
    };
  }
  return {
    errors: [],
    value: { ...row, publicPriceId: price.id, validFrom, validTo, benefitAmount },
  };
}

export function validatePolicyCombinationBatch(
  rows: readonly PolicyCombinationRowInput[],
  prices: readonly CommercialOfferBuilderPrice[],
  policies: readonly PolicyCombinationPolicy[],
):
  | { readonly ok: true; readonly rows: readonly ValidatedPolicyCombinationRow[] }
  | { readonly ok: false; readonly issues: readonly PolicyCombinationIssue[] } {
  const candidates = rows.filter((row) => row.productId || row.policyIds.length > 0);
  if (candidates.length === 0)
    return { ok: false, issues: [{ clientRowId: 'row-1', message: 'Preencha uma combinação.' }] };
  if (candidates.length > POLICY_COMBINATION_MAX_ROWS)
    return {
      ok: false,
      issues: [
        {
          clientRowId: candidates[100]!.clientRowId,
          message: 'O lote aceita no máximo 100 combinações.',
        },
      ],
    };
  const issues: PolicyCombinationIssue[] = [];
  const validated: ValidatedPolicyCombinationRow[] = [];
  const clientIds = new Set<string>();
  const fingerprints = new Set<string>();
  for (const row of candidates) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(row.clientRowId) ||
      clientIds.has(row.clientRowId)
    ) {
      issues.push({
        clientRowId: row.clientRowId,
        message: 'Identificador local inválido ou repetido.',
      });
    }
    clientIds.add(row.clientRowId);
    const result = derivePolicyCombinationRow(row, prices, policies);
    issues.push(...result.errors.map((message) => ({ clientRowId: row.clientRowId, message })));
    if (!result.value) continue;
    const fingerprint = `${row.productId}:${[...row.policyIds].sort((a, b) => Number(a) - Number(b)).join(',')}`;
    if (fingerprints.has(fingerprint))
      issues.push({
        clientRowId: row.clientRowId,
        message: 'A mesma combinação aparece mais de uma vez no lote.',
      });
    else fingerprints.add(fingerprint);
    validated.push(result.value);
  }
  return issues.length
    ? { ok: false, issues: Object.freeze(issues) }
    : { ok: true, rows: Object.freeze(validated) };
}
