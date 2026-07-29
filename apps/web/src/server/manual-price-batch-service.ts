import 'server-only';

import {
  ManualPriceBatchConflictError,
  ManualPriceBatchSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import type {
  ManualPriceBatchActionStateDto,
  ManualPriceBatchProductOptionDto,
} from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import {
  executeManualPriceBatchCreation,
  type SaveManualPriceBatchDependencies,
} from '@/application/admin/manual-price-batch';
import { requireRole } from '@/auth/authorization';

export interface ManualPriceBatchServiceDependencies {
  readonly authorize: () => Promise<{ readonly actorId: string }>;
  readonly createRepository: () => ManualPriceBatchSupabaseAdapter;
}

const defaultListDependencies: ManualPriceBatchServiceDependencies = {
  authorize: async () => {
    const identity = await requireRole('admin');
    return { actorId: identity.profile.id };
  },
  createRepository: () => new ManualPriceBatchSupabaseAdapter(),
};

const saveDependencies: SaveManualPriceBatchDependencies = {
  ...defaultListDependencies,
  createCorrelationId: randomUUID,
  conflictRowIds: (error) =>
    error instanceof ManualPriceBatchConflictError ? error.clientRowIds : null,
  revalidate: revalidatePath,
};

export async function loadManualPriceBatchProductOptions(
  dependencies: ManualPriceBatchServiceDependencies = defaultListDependencies,
): Promise<
  | { readonly ok: true; readonly data: readonly ManualPriceBatchProductOptionDto[] }
  | { readonly ok: false }
> {
  await dependencies.authorize();
  try {
    const products = await dependencies.createRepository().listProductOptions();
    return {
      ok: true,
      data: products.map((product) => ({
        id: product.id,
        displayName: `${product.brand} — ${product.model} — ${product.version} — ${product.modelYear}/${product.productionYear}`,
        isActive: product.isActive,
        isPublic: product.isPublic,
      })),
    };
  } catch {
    console.error('Manual price batch products could not be loaded.');
    return { ok: false };
  }
}

export function saveManualPriceBatch(formData: FormData): Promise<ManualPriceBatchActionStateDto> {
  return executeManualPriceBatchCreation(formData, saveDependencies);
}
