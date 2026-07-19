import type { ComparisonPageDataDto, ComparisonPageResultDto } from '@compra-car/contracts';
import { unstable_cache } from 'next/cache';

import { toPublicComparisonError } from '@/application/comparison/comparison-errors';
import { toComparisonPageData } from '@/application/comparison/comparison-mapper';
import { parseComparisonRequest } from '@/application/comparison/comparison-request';

import { CATALOG_CACHE_TAGS } from './catalog-cache';
import { getCatalogCompositionRoot } from './composition-root';

const COMPARISON_CACHE_TAG = 'comparison';
const CACHE_REVALIDATE_SECONDS = 300;

async function executeComparison(vehicleIds: readonly string[]): Promise<ComparisonPageDataDto> {
  const result = await getCatalogCompositionRoot().compareVehicles.execute({ vehicleIds });
  return toComparisonPageData(result);
}

async function getCachedComparison(vehicleIds: readonly string[]): Promise<ComparisonPageDataDto> {
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
): Promise<ComparisonPageResultDto> {
  const parsed = parseComparisonRequest(rawVehicles);
  if (!parsed.ok) return parsed;

  try {
    return { ok: true, data: await getCachedComparison(parsed.vehicleIds) };
  } catch (error: unknown) {
    return { ok: false, error: toPublicComparisonError(error) };
  }
}
