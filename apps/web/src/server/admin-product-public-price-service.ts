import { ProductPublicPriceSupabaseAdapter } from '@compra-car/adapter-supabase';
import {
  ListProductPublicPrices,
  type ListProductPublicPricesInput,
  type ProductPublicPriceRepository,
} from '@compra-car/core';
import type { ProductPublicPriceListPageDto } from '@compra-car/contracts';

import { requireRole } from '../auth/authorization';

export type AdminProductPublicPriceListResult =
  { readonly ok: true; readonly data: ProductPublicPriceListPageDto } | { readonly ok: false };

export interface AdminProductPublicPriceServiceDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createRepository: () => ProductPublicPriceRepository;
}

const defaultDependencies: AdminProductPublicPriceServiceDependencies = {
  authorize: () => requireRole('admin'),
  createRepository: () => new ProductPublicPriceSupabaseAdapter(),
};

export async function loadAdminProductPublicPrices(
  input: ListProductPublicPricesInput = {},
  dependencies: AdminProductPublicPriceServiceDependencies = defaultDependencies,
): Promise<AdminProductPublicPriceListResult> {
  await dependencies.authorize();

  try {
    const result = await new ListProductPublicPrices(dependencies.createRepository()).execute(
      input,
    );
    return { ok: true, data: result };
  } catch {
    console.error('Admin product public price list could not be loaded.');
    return { ok: false };
  }
}
