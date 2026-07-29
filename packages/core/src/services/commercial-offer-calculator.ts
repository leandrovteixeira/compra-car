import type { CommercialOffer, CommercialPolicy } from '../entities/commercial-pricing';
import { subtractMoney, sumMoney } from '../value-objects/money';

export interface CommercialOfferPolicyAmount {
  readonly id: string;
  readonly productId: string;
  readonly customerBenefitAmount: string;
}

export function calculateCommercialOfferBenefit(
  policies: readonly CommercialOfferPolicyAmount[],
  expectedProductId?: string,
): string {
  if (policies.length === 0) throw new Error('Commercial offer requires at least one policy.');
  const seen = new Set<string>();
  const productId = expectedProductId ?? policies[0]!.productId;
  for (const policy of policies) {
    if (seen.has(policy.id)) throw new Error('Commercial offer cannot contain a policy twice.');
    if (policy.productId !== productId)
      throw new Error('Offer and policies must belong to one product.');
    seen.add(policy.id);
  }
  return sumMoney(policies.map((policy) => policy.customerBenefitAmount));
}

export function calculateTransactionalPrice(
  publicPrice: string,
  policies: readonly CommercialOfferPolicyAmount[],
  expectedProductId?: string,
): string {
  return subtractMoney(publicPrice, calculateCommercialOfferBenefit(policies, expectedProductId));
}

export function validateCommercialOfferComposition(
  offer: Pick<CommercialOffer, 'productId' | 'validFrom' | 'validTo'>,
  policies: readonly Pick<
    CommercialPolicy,
    'id' | 'productId' | 'startsOn' | 'endsOn' | 'status' | 'customerBenefitAmount'
  >[],
): readonly string[] {
  const errors: string[] = [];
  if (policies.length === 0) errors.push('Offer requires at least one policy.');
  for (const policy of policies) {
    if (policy.productId !== offer.productId)
      errors.push(`Policy ${policy.id} belongs to another product.`);
    if (policy.status !== 'published') errors.push(`Policy ${policy.id} is not published.`);
    if (
      policy.startsOn > offer.validFrom ||
      (policy.endsOn !== null && policy.endsOn < offer.validTo)
    ) {
      errors.push(`Policy ${policy.id} does not cover the offer period.`);
    }
  }
  return errors;
}
