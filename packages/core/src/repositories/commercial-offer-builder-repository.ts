import type { CommercialOffer, CommercialPolicy } from '../entities/commercial-pricing';
import type {
  CommercialOfferBuilderPrice,
  ValidatedCommercialOfferDraft,
} from '../admin/commercial-offer-builder';
import type { ManualPriceBatchProductOption } from './manual-price-batch-repository';
export interface CommercialOfferDraftSummary extends CommercialOffer {
  readonly benefitAmount: string;
  readonly transactionalPrice: string;
}
export interface CommercialOfferBuilderRepository {
  listProductOptions(): Promise<readonly ManualPriceBatchProductOption[]>;
  listPublishedPrices(): Promise<readonly CommercialOfferBuilderPrice[]>;
  listAvailablePolicies(): Promise<readonly CommercialPolicy[]>;
  getPrice(id: string): Promise<CommercialOfferBuilderPrice | null>;
  getPolicies(ids: readonly string[]): Promise<readonly CommercialPolicy[]>;
  createOfferDraft(input: {
    readonly offer: ValidatedCommercialOfferDraft;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<CommercialOfferDraftSummary>;
  listRecentDrafts(): Promise<readonly CommercialOfferDraftSummary[]>;
}
