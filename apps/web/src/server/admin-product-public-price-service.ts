import { ProductPublicPriceSupabaseAdapter } from '@compra-car/adapter-supabase';
import {
  ListProductPublicPrices,
  type ListProductPublicPricesInput,
  type ProductPublicPriceRepository,
} from '@compra-car/core';
import type { ProductPublicPriceListPageDto } from '@compra-car/contracts';

import { requireRole } from '../auth/authorization';
import { randomUUID } from 'node:crypto';

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

export async function publishAdminProductPublicPrice(formData: FormData): Promise<{
  readonly ok: boolean;
  readonly message: string;
}> {
  const { profile } = await requireRole('admin');
  const id = String(formData.get('id') ?? '');
  const expectedLockVersion = Number(formData.get('lockVersion'));
  if (!/^\d+$/u.test(id) || !Number.isSafeInteger(expectedLockVersion) || expectedLockVersion < 1) {
    return { ok: false, message: 'Preço inválido para publicação.' };
  }
  try {
    await new ProductPublicPriceSupabaseAdapter().publishProductPublicPrice({
      id,
      expectedLockVersion,
      actorId: profile.id,
      correlationId: randomUUID(),
    });
    return { ok: true, message: 'Preço publicado com sucesso.' };
  } catch {
    console.error('Admin product public price publication failed.');
    return {
      ok: false,
      message: 'Não foi possível publicar. Recarregue os dados e tente novamente.',
    };
  }
}
