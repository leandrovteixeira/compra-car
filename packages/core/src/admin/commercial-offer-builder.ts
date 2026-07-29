import type { CommercialPolicy } from '../entities/commercial-pricing';
import type { PricingWorkflowStatus } from '../entities/product-public-price';
import { CURRENT_COMMERCIAL_POLICY_TYPES } from '../entities/commercial-pricing';
import { isValidManualPriceDate } from './manual-price-batch';
import {
  calculateCommercialOfferBenefit,
  calculateTransactionalPrice,
} from '../services/commercial-offer-calculator';

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
