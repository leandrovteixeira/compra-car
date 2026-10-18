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
  const correlationId = randomUUID();
  try {
    console.info('Admin product public price publication started.', {
      correlationId,
      expectedLockVersion,
      priceId: id,
    });
    const published = await new ProductPublicPriceSupabaseAdapter().publishProductPublicPrice({
      id,
      expectedLockVersion,
      actorId: profile.id,
      correlationId,
    });
    console.info('Admin product public price publication succeeded.', {
      correlationId,
      lockVersion: published.lockVersion,
      priceId: published.id,
      status: published.status,
    });
    return { ok: true, message: 'Preço publicado com sucesso.' };
  } catch (error) {
    console.error('Admin product public price publication failed.', {
      correlationId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      priceId: id,
    });
    return {
      ok: false,
      message: 'Não foi possível publicar. Recarregue os dados e tente novamente.',
    };
  }
}

/**
 * Fetches the complete filtered result set for a scrollable admin list.
 * Pagination remains an internal repository concern; the UI never drops records.
 * Sequential batches bound database concurrency on large catalogs.
 */
export async function loadAllAdminProductPublicPrices(
  input: ListProductPublicPricesInput = {},
): Promise<AdminProductPublicPriceListResult> {
  const first = await loadAdminProductPublicPrices({ ...input, page: 1 });
  if (!first.ok || first.data.pageCount <= 1) return first;
  const items = [...first.data.items];
  for (let start = 2; start <= first.data.pageCount; start += 6) {
    const end = Math.min(first.data.pageCount, start + 5);
    const pages = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, index) =>
        loadAdminProductPublicPrices({ ...input, page: start + index }),
      ),
    );
    if (pages.some(page => !page.ok)) return { ok: false };
    for (const page of pages) {
      if (page.ok) items.push(...page.data.items);
    }
  }
  return { ok: true, data: { ...first.data, page: 1, pageCount: 1, items } };
}
