import type { ComparisonPageErrorDto } from '@compra-car/contracts';
import { unstable_cache } from 'next/cache';

import { toPublicComparisonError } from '@/application/comparison/comparison-errors';
import { toComparisonPageData } from '@/application/comparison/comparison-mapper';
import { parseComparisonRequest } from '@/application/comparison/comparison-request';
import type { ComparisonPageViewModel } from '@/application/comparison/comparison-view-model';

import { CATALOG_CACHE_TAGS } from './catalog-cache';
import { getCatalogCompositionRoot } from './composition-root';
import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';

const COMPARISON_CACHE_TAG = 'comparison';
const CACHE_REVALIDATE_SECONDS = 300;

type ComparisonPageViewResult =
  | { readonly ok: true; readonly data: ComparisonPageViewModel }
  | { readonly ok: false; readonly error: ComparisonPageErrorDto };

async function executeComparison(vehicleIds: readonly string[]): Promise<ComparisonPageViewModel> {
  const result = await getCatalogCompositionRoot().compareVehicles.execute({ vehicleIds });
  return toComparisonPageData(result);
}

async function getCachedComparison(
  vehicleIds: readonly string[],
): Promise<ComparisonPageViewModel> {
  const cachedComparison = unstable_cache(
    () => executeComparison(vehicleIds),
    ['comparison', ...vehicleIds],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [
        CATALOG_CACHE_TAGS.all,
        COMPARISON_CACHE_TAG,
        ...vehicleIds.map((id) => `vehicle:${id}`),
      ],
    },
  );

  return cachedComparison();
}

export async function loadComparisonPage(
  rawVehicles: string | readonly string[] | undefined,
): Promise<ComparisonPageViewResult> {
  const parsed = parseComparisonRequest(rawVehicles);
  if (!parsed.ok) return parsed;

  const tier = await getAccountTier();
  if (parsed.vehicleIds.length > comparisonLimit(tier)) {
    return { ok: false, error: { code: 'INVALID_VEHICLE_IDS', message: 'A quantidade de veículos excede o limite da sua conta.' } };
  }

  try {
    return { ok: true, data: await getCachedComparison(parsed.vehicleIds) };
  } catch (error: unknown) {
    return { ok: false, error: toPublicComparisonError(error) };
  }
}
