import {
  validateUpdateProductPublicPriceInput,
  type ProductPublicPriceWriteFieldErrors,
  type UpdateProductPublicPriceInput,
} from '../admin/product-public-price';
import type { ProductPublicPrice } from '../entities/product-public-price';
import type { ProductPublicPriceRepository } from '../repositories/product-public-price-repository';

export type UpdateProductPublicPriceResult =
  | { readonly ok: true; readonly price: ProductPublicPrice }
  | {
      readonly ok: false;
      readonly code: 'VALIDATION_ERROR';
      readonly fieldErrors: ProductPublicPriceWriteFieldErrors;
    }
  | { readonly ok: false; readonly code: 'NOT_FOUND' | 'NOT_EDITABLE' | 'CONFLICT' };

export class UpdateProductPublicPrice {
  constructor(private readonly repository: ProductPublicPriceRepository) {}

  async execute(
    input: UpdateProductPublicPriceInput,
    actorId: string,
  ): Promise<UpdateProductPublicPriceResult> {
    const validation = validateUpdateProductPublicPriceInput(input);
    if (!validation.ok)
      return { ok: false, code: 'VALIDATION_ERROR', fieldErrors: validation.fieldErrors };
    const result = await this.repository.updateProductPublicPrice({
      id: validation.data.id,
      amount: validation.data.amount,
      startsOn: validation.data.startsOn,
      endsOn: validation.data.endsOn,
      expectedLockVersion: validation.data.lockVersion,
      actorId,
    });
    return result.status === 'updated'
      ? { ok: true, price: result.price }
      : {
          ok: false,
          code:
            result.status === 'not_found'
              ? 'NOT_FOUND'
              : result.status === 'not_editable'
                ? 'NOT_EDITABLE'
                : 'CONFLICT',
        };
  }
}
