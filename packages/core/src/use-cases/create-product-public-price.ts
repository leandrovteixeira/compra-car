import {
  validateProductPublicPriceWriteInput,
  type ProductPublicPriceWriteFieldErrors,
  type ProductPublicPriceWriteInput,
} from '../admin/product-public-price';
import type { ProductPublicPrice } from '../entities/product-public-price';
import type { ProductPublicPriceRepository } from '../repositories/product-public-price-repository';

export type CreateProductPublicPriceResult =
  | { readonly ok: true; readonly price: ProductPublicPrice }
  | {
      readonly ok: false;
      readonly code: 'VALIDATION_ERROR';
      readonly fieldErrors: ProductPublicPriceWriteFieldErrors;
    };

export class CreateProductPublicPrice {
  constructor(private readonly repository: ProductPublicPriceRepository) {}

  async execute(
    input: ProductPublicPriceWriteInput,
    actorId: string,
  ): Promise<CreateProductPublicPriceResult> {
    const validation = validateProductPublicPriceWriteInput(input);
    if (!validation.ok)
      return { ok: false, code: 'VALIDATION_ERROR', fieldErrors: validation.fieldErrors };
    return {
      ok: true,
      price: await this.repository.createProductPublicPrice({ ...validation.data, actorId }),
    };
  }
}
