'use server';
import type { OfferBuilderActionStateDto } from '@compra-car/contracts';
import { saveCommercialOfferDraft } from '@/server/commercial-offer-builder-service';
export async function createCommercialOfferDraftAction(
  _state: OfferBuilderActionStateDto,
  formData: FormData,
) {
  return saveCommercialOfferDraft(formData);
}
