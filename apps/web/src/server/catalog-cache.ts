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

function normalizedIdentity(vehicle: CatalogVehicleDto): string {
  return [vehicle.brand, vehicle.model, vehicle.version]
    .map((value) => value.trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

function yearNumber(value: CatalogVehicleDto['modelYear'] | CatalogVehicleDto['productionYear']): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function keepLatestCommercialProduct(vehicles: readonly CatalogVehicleDto[]): readonly CatalogVehicleDto[] {
  const latestByIdentity = new Map<string, { modelYear: number; productionYear: number }>();
  for (const vehicle of vehicles) {
    const key = normalizedIdentity(vehicle);
    const modelYear = yearNumber(vehicle.modelYear);
    const productionYear = yearNumber(vehicle.productionYear);
    const current = latestByIdentity.get(key);
    if (
      current === undefined ||
      modelYear > current.modelYear ||
      (modelYear === current.modelYear && productionYear > current.productionYear)
    ) {
      latestByIdentity.set(key, { modelYear, productionYear });
    }
  }
  return vehicles.filter((vehicle) => {
    const latest = latestByIdentity.get(normalizedIdentity(vehicle));
    return (
      yearNumber(vehicle.modelYear) === latest?.modelYear &&
      yearNumber(vehicle.productionYear) === latest.productionYear
    );
  });
}

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
    return keepLatestCommercialProduct(vehicles.map(toCatalogVehicle));
  },
  ['catalog-vehicles'],
  {
    revalidate: CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.all, CATALOG_CACHE_TAGS.vehicles],
  },
);

export const getCachedCatalogVehicles = unstable_cache(
  async (): Promise<readonly CatalogVehicleDto[]> => {
    const vehicles = await getCatalogCompositionRoot().listAvailableVehicles.execute();
    return keepLatestCommercialProduct(vehicles.map(toCatalogVehicle));
  },
  ['catalog-search-vehicles'],
  {
    revalidate: CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.all, CATALOG_CACHE_TAGS.vehicles],
  },
);
