'use server';

import type { ProductPublicPriceActionStateDto } from '@compra-car/contracts';

import {
  saveExistingAdminProductPublicPrice,
  saveNewAdminProductPublicPrice,
} from '@/server/save-admin-product-public-price';
import { publishAdminProductPublicPrice } from '@/server/admin-product-public-price-service';

export async function createProductPublicPriceAction(
  _previousState: ProductPublicPriceActionStateDto,
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  return saveNewAdminProductPublicPrice(formData);
}

export async function updateProductPublicPriceAction(
  _previousState: ProductPublicPriceActionStateDto,
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  return saveExistingAdminProductPublicPrice(formData);
}

export async function publishProductPublicPriceAction(formData: FormData) {
  return publishAdminProductPublicPrice(formData);
}
