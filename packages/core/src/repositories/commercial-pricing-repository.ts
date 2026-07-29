import type {
  CommercialOffer,
  CommercialOfferPolicyMembership,
  CommercialPolicy,
} from '../entities/commercial-pricing';

export interface PricingMutationContext {
  readonly actorId: string;
  readonly correlationId: string;
}

export interface CommercialPricingRepository {
  listCommercialPoliciesByProduct(productId: string): Promise<readonly CommercialPolicy[]>;
  getCommercialOffer(id: string): Promise<CommercialOffer | null>;
  linkPolicyToOffer(input: {
    readonly offerId: string;
    readonly policyId: string;
    readonly expectedOfferLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<CommercialOfferPolicyMembership>;
  unlinkPolicyFromOffer(input: {
    readonly offerId: string;
    readonly policyId: string;
    readonly expectedOfferLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<boolean>;
  publishCommercialPolicy(input: {
    readonly policyId: string;
    readonly expectedLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<CommercialPolicy>;
  publishCommercialOffer(input: {
    readonly offerId: string;
    readonly expectedLockVersion: number;
    readonly context: PricingMutationContext;
  }): Promise<CommercialOffer>;
}
