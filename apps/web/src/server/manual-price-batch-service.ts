import 'server-only';

import {
  ManualPriceBatchConflictError,
  ManualPriceBatchSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import { formatAdministrativeVehicleName } from '@compra-car/core';
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
import { withDevTiming } from '@/server/dev-timing';

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
  try {
    const products = await withDevTiming('pricing.listProductOptions', () =>
      dependencies.createRepository().listProductOptions(),
    );
    return {
      ok: true,
      data: products.map((product) => ({
        id: product.id,
        displayName: formatAdministrativeVehicleName(product),
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
