import type { CatalogOptionDto, CatalogVehicleDto } from '@compra-car/contracts';
import { unstable_cache } from 'next/cache';

import { getCatalogCompositionRoot } from './composition-root';
import { toCatalogOption, toCatalogVehicle } from './catalog-dtos';

export const CATALOG_CACHE_TAGS = Object.freeze({
  all: 'catalog',
  brands: 'catalog:brands',
  models: 'catalog:models',
  vehicles: 'catalog:vehicles',
});

const CACHE_REVALIDATE_SECONDS = 300;

export const getCachedBrands = unstable_cache(
  async (): Promise<readonly CatalogOptionDto[]> => {
    const brands = await getCatalogCompositionRoot().listAvailableBrands.execute();
    return brands.map(toCatalogOption);
  },
  ['catalog-brands'],
  {
    revalidate: CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.all, CATALOG_CACHE_TAGS.brands],
  },
);

export const getCachedModels = unstable_cache(
  async (brand: string): Promise<readonly CatalogOptionDto[]> => {
    const models = await getCatalogCompositionRoot().listAvailableModels.execute({ brand });
    return models.map(toCatalogOption);
  },
  ['catalog-models'],
  {
    revalidate: CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.all, CATALOG_CACHE_TAGS.models],
  },
);

export const getCachedVehicles = unstable_cache(
  async (brand: string, model: string): Promise<readonly CatalogVehicleDto[]> => {
    const vehicles = await getCatalogCompositionRoot().listAvailableVehicles.execute({
      brand,
      model,
    });
    return vehicles.map(toCatalogVehicle);
  },
  ['catalog-vehicles'],
  {
    revalidate: CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.all, CATALOG_CACHE_TAGS.vehicles],
  },
);
