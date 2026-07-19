'use server';

import type {
  CatalogActionErrorDto,
  CatalogActionResultDto,
  CatalogOptionDto,
  CatalogVehicleDto,
} from '@compra-car/contracts';

import { getCachedBrands, getCachedModels, getCachedVehicles } from '@/server/catalog-cache';

const INVALID_INPUT_ERROR = Object.freeze({
  code: 'INVALID_INPUT',
  message: 'Selecione valores válidos para consultar o catálogo.',
}) satisfies CatalogActionErrorDto;

const CATALOG_UNAVAILABLE_ERROR = Object.freeze({
  code: 'CATALOG_UNAVAILABLE',
  message: 'Não foi possível carregar o catálogo agora. Tente novamente.',
}) satisfies CatalogActionErrorDto;

function success<T>(data: T): CatalogActionResultDto<T> {
  return { ok: true, data };
}

function failure(error: CatalogActionErrorDto): CatalogActionResultDto<never> {
  return { ok: false, error };
}

function clean(value: string): string {
  return value.trim();
}

export async function getBrands(): Promise<CatalogActionResultDto<readonly CatalogOptionDto[]>> {
  try {
    return success(await getCachedBrands());
  } catch {
    return failure(CATALOG_UNAVAILABLE_ERROR);
  }
}

export async function getModels(
  brand: string,
): Promise<CatalogActionResultDto<readonly CatalogOptionDto[]>> {
  const normalizedBrand = clean(brand);
  if (!normalizedBrand) return failure(INVALID_INPUT_ERROR);

  try {
    return success(await getCachedModels(normalizedBrand));
  } catch {
    return failure(CATALOG_UNAVAILABLE_ERROR);
  }
}

export async function getVehicles(
  brand: string,
  model: string,
): Promise<CatalogActionResultDto<readonly CatalogVehicleDto[]>> {
  const normalizedBrand = clean(brand);
  const normalizedModel = clean(model);
  if (!normalizedBrand || !normalizedModel) return failure(INVALID_INPUT_ERROR);

  try {
    return success(await getCachedVehicles(normalizedBrand, normalizedModel));
  } catch {
    return failure(CATALOG_UNAVAILABLE_ERROR);
  }
}
