import {
  validateCommercialOfferDraft,
  type CreateCommercialOfferDraftInput,
} from '../admin/commercial-offer-builder';
import type {
  CommercialOfferBuilderRepository,
  CommercialOfferDraftSummary,
} from '../repositories/commercial-offer-builder-repository';
export type CreateCommercialOfferDraftResult =
  | { readonly ok: true; readonly offer: CommercialOfferDraftSummary }
  | { readonly ok: false; readonly errors: readonly string[] };
export class CreateCommercialOfferDraft {
  constructor(private readonly repository: CommercialOfferBuilderRepository) {}
  async execute(
    input: CreateCommercialOfferDraftInput,
    context: { readonly actorId: string; readonly correlationId: string },
  ): Promise<CreateCommercialOfferDraftResult> {
    const [price, policies] = await Promise.all([
      this.repository.getPrice(input.publicPriceId),
      this.repository.getPolicies(input.policyIds),
    ]);
    const validation = validateCommercialOfferDraft(input, price, policies);
    if (!validation.ok) return validation;
    return {
      ok: true,
      offer: await this.repository.createOfferDraft({ offer: validation.value, ...context }),
    };
  }
}
