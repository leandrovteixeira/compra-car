import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import {
  CompareVehicles,
  ListAvailableBrands,
  ListAvailableModels,
  ListAvailableVehicles,
} from '@compra-car/core';

export interface CatalogCompositionRoot {
  readonly listAvailableBrands: ListAvailableBrands;
  readonly listAvailableModels: ListAvailableModels;
  readonly listAvailableVehicles: ListAvailableVehicles;
  readonly compareVehicles: CompareVehicles;
}

let catalogCompositionRoot: CatalogCompositionRoot | undefined;

export function getCatalogCompositionRoot(): CatalogCompositionRoot {
  if (catalogCompositionRoot) return catalogCompositionRoot;

  const vehicleRepository = new LegacySupabaseAdapter();
  catalogCompositionRoot = Object.freeze({
    listAvailableBrands: new ListAvailableBrands(vehicleRepository),
    listAvailableModels: new ListAvailableModels(vehicleRepository),
    listAvailableVehicles: new ListAvailableVehicles(vehicleRepository),
    compareVehicles: new CompareVehicles(vehicleRepository, vehicleRepository),
  });

  return catalogCompositionRoot;
}
