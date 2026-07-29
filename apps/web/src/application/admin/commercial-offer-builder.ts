import type { OfferBuilderActionStateDto, OfferBuilderFormDto } from '@compra-car/contracts';
import {
  CreateCommercialOfferDraft,
  type CommercialOfferBuilderRepository,
} from '@compra-car/core';
export const EMPTY_OFFER_BUILDER_FORM: OfferBuilderFormDto = Object.freeze({
  productId: '',
  publicPriceId: '',
  validFrom: '',
  validTo: '',
  policyIds: [],
});
function read(formData: FormData): OfferBuilderFormDto | null {
  const productId = formData.get('productId'),
    publicPriceId = formData.get('publicPriceId'),
    validFrom = formData.get('validFrom'),
    validTo = formData.get('validTo'),
    raw = formData.get('policyIds');
  if (![productId, publicPriceId, validFrom, validTo, raw].every((v) => typeof v === 'string'))
    return null;
  try {
    const policyIds: unknown = JSON.parse(raw as string);
    return Array.isArray(policyIds) && policyIds.every((id) => typeof id === 'string')
      ? {
          productId: productId as string,
          publicPriceId: publicPriceId as string,
          validFrom: validFrom as string,
          validTo: validTo as string,
          policyIds,
        }
      : null;
  } catch {
    return null;
  }
}
export async function executeCommercialOfferDraftCreation(
  formData: FormData,
  deps: {
    authorize: () => Promise<{ actorId: string }>;
    repository: () => CommercialOfferBuilderRepository;
    correlationId: () => string;
    revalidate: (path: string) => void;
  },
): Promise<OfferBuilderActionStateDto> {
  const { actorId } = await deps.authorize();
  const values = read(formData);
  if (!values)
    return {
      status: 'error',
      values: EMPTY_OFFER_BUILDER_FORM,
      errors: [],
      message: 'Os dados da oferta são inválidos.',
    };
  try {
    const result = await new CreateCommercialOfferDraft(deps.repository()).execute(values, {
      actorId,
      correlationId: deps.correlationId(),
    });
    if (!result.ok)
      return {
        status: 'error',
        values,
        errors: result.errors,
        message: 'Revise a composição. Nenhuma oferta foi criada.',
      };
    deps.revalidate('/admin/prices/offers');
    return {
      status: 'success',
      values: EMPTY_OFFER_BUILDER_FORM,
      errors: [],
      message: `Oferta criada como rascunho com ${result.offer.policyIds.length} política(s).`,
      offer: {
        id: result.offer.id,
        productId: result.offer.productId,
        publicPriceAmount: result.offer.publicPriceAmount!,
        validFrom: result.offer.validFrom,
        validTo: result.offer.validTo,
        status: 'draft',
        policyCount: result.offer.policyIds.length,
        benefitAmount: result.offer.benefitAmount,
        transactionalPrice: result.offer.transactionalPrice,
      },
    };
  } catch {
    console.error('Commercial offer builder failed.');
    return {
      status: 'error',
      values,
      errors: [],
      message: 'Não foi possível salvar a oferta. Nenhuma associação foi criada.',
    };
  }
}
