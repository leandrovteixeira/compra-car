import 'server-only';

import { ProductPublicPriceSupabaseAdapter } from '@compra-car/adapter-supabase';
import type { ProductPublicPriceActionStateDto } from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import {
  executeProductPublicPriceCreation,
  executeProductPublicPriceUpdate,
  type SaveProductPublicPriceDependencies,
} from '@/application/admin/save-product-public-price';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';

const dependencies: SaveProductPublicPriceDependencies = {
  authorize: async () => {
    const identity = await requireFeatureIdentity23C('price-administration', 'write');
    return { actorId: identity.profile.id };
  },
  createRepository: () => new ProductPublicPriceSupabaseAdapter(),
  revalidate: revalidatePath,
};

export function saveNewAdminProductPublicPrice(
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  return executeProductPublicPriceCreation(formData, dependencies);
}

export function saveExistingAdminProductPublicPrice(
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  return executeProductPublicPriceUpdate(formData, dependencies);
}
