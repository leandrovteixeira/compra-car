import type {
  AvailableVehicleFilters,
  ComparisonItem,
  ComparisonRepository,
  Vehicle,
  VehicleComparisonValue,
  VehicleId,
  VehicleRepository,
} from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { LegacyAdapterMappingError, LegacyAdapterQueryError } from './errors';
import type { LegacyProductRow, LegacyProductSpecRow, LegacySpecRow } from './legacy-dtos';
import {
  mapLegacyProductToVehicle,
  mapLegacyRowsToComparisonValues,
  mapLegacySpecToComparisonItem,
} from './mappers';

const PRODUCT_COLUMNS = 'id,brand,model,version,model_year,production_year,is_active,is_public';
const SPEC_COLUMNS =
  'id,code,type,group_name,equipment_group,spec_set,detail,unit,value_direction,is_active';
const PRODUCT_SPEC_COLUMNS = 'product_id,equipment_id,value,is_present,input_unit';

interface ComparisonBatch {
  readonly specs: readonly LegacySpecRow[];
  readonly associations: readonly LegacyProductSpecRow[];
}

function queryError(operation: string, error: PostgrestError): LegacyAdapterQueryError {
  return new LegacyAdapterQueryError(`Falha ao consultar dados legados (${operation}).`, {
    cause: error,
  });
}

function parseLegacyId(id: VehicleId): number {
  const parsed = Number(String(id));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new LegacyAdapterMappingError(`VehicleId incompatível com products.id: ${String(id)}.`);
  }
  return parsed;
}

export class LegacySupabaseAdapter implements VehicleRepository, ComparisonRepository {
  private readonly comparisonBatches = new Map<string, Promise<ComparisonBatch>>();

  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }

  async listAvailableBrands(): Promise<readonly string[]> {
    const vehicles = await this.listPublicEligibleVehicles();
    return [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  async listAvailableModels(brand: string): Promise<readonly string[]> {
    const vehicles = await this.listPublicEligibleVehicles({ brand });
    return [...new Set(vehicles.map((vehicle) => vehicle.model))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  listAvailableVehicles(filters?: AvailableVehicleFilters): Promise<readonly Vehicle[]> {
    return this.listPublicEligibleVehicles(filters);
  }

  async listAdministrativeVehicles(): Promise<readonly Vehicle[]> {
    const { data, error } = await this.client.from('products').select(PRODUCT_COLUMNS);
    if (error) throw queryError('products administrativos', error);

    return ((data ?? []) as unknown as LegacyProductRow[]).map(mapLegacyProductToVehicle);
  }

  async listPublicEligibleVehicles(
    filters: AvailableVehicleFilters = {},
  ): Promise<readonly Vehicle[]> {
    let query = this.client
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('is_active', true)
      .eq('is_public', true);

    if (filters.brand) query = query.eq('brand', filters.brand);
    if (filters.model) query = query.eq('model', filters.model);

    const { data, error } = await query;
    if (error) throw queryError('products públicos', error);

    const products = (data ?? []) as unknown as LegacyProductRow[];
    if (products.length === 0) return [];

    const ids = products.map((product) => product.id);
    const { data: associationData, error: associationError } = await this.client
      .from('product_specs')
      .select('product_id,equipment_id')
      .in('product_id', ids);
    if (associationError) throw queryError('elegibilidade em product_specs', associationError);

    const associations = (associationData ?? []) as unknown as Pick<
      LegacyProductSpecRow,
      'product_id' | 'equipment_id'
    >[];
    if (associations.length === 0) return [];

    const equipmentIds = [...new Set(associations.map((row) => row.equipment_id))];
    const { data: specData, error: specError } = await this.client
      .from('specs')
      .select('id')
      .eq('is_active', true)
      .in('id', equipmentIds);
    if (specError) throw queryError('specs ativas para elegibilidade', specError);

    const activeSpecIds = new Set(
      ((specData ?? []) as unknown as { readonly id: number }[]).map((row) => row.id),
    );
    const eligibleIds = new Set(
      associations
        .filter((row) => activeSpecIds.has(row.equipment_id))
        .map((row) => row.product_id),
    );

    return products.filter((product) => eligibleIds.has(product.id)).map(mapLegacyProductToVehicle);
  }

  async getVehiclesByIds(ids: readonly VehicleId[]): Promise<readonly Vehicle[]> {
    if (ids.length === 0) return [];
    const legacyIds = ids.map(parseLegacyId);
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('is_active', true)
      .eq('is_public', true)
      .in('id', legacyIds);
    if (error) throw queryError('products por ids', error);

    const vehicles = ((data ?? []) as unknown as LegacyProductRow[]).map(mapLegacyProductToVehicle);
    const byId = new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle]));
    return ids.flatMap((id) => {
      const vehicle = byId.get(String(id));
      return vehicle ? [vehicle] : [];
    });
  }

  async getComparisonItemsByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly ComparisonItem[]> {
    const batch = await this.loadComparisonBatch(vehicleIds);
    return batch.specs.map(mapLegacySpecToComparisonItem);
  }

  async getComparisonValuesByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly VehicleComparisonValue[]> {
    const batch = await this.loadComparisonBatch(vehicleIds);
    return mapLegacyRowsToComparisonValues(vehicleIds, batch.specs, batch.associations);
  }

  private loadComparisonBatch(vehicleIds: readonly VehicleId[]): Promise<ComparisonBatch> {
    if (vehicleIds.length === 0) return Promise.resolve({ specs: [], associations: [] });
    const key = vehicleIds.map(String).sort().join(',');
    const current = this.comparisonBatches.get(key);
    if (current) return current;

    const pending = this.queryComparisonBatch(vehicleIds).finally(() => {
      this.comparisonBatches.delete(key);
    });
    this.comparisonBatches.set(key, pending);
    return pending;
  }

  private async queryComparisonBatch(vehicleIds: readonly VehicleId[]): Promise<ComparisonBatch> {
    const productIds = vehicleIds.map(parseLegacyId);
    const { data, error } = await this.client
      .from('product_specs')
      .select(PRODUCT_SPEC_COLUMNS)
      .in('product_id', productIds);
    if (error) throw queryError('product_specs da comparação', error);

    const associations = (data ?? []) as unknown as LegacyProductSpecRow[];
    if (associations.length === 0) return { specs: [], associations: [] };

    const equipmentIds = [...new Set(associations.map((row) => row.equipment_id))];
    const { data: specData, error: specError } = await this.client
      .from('specs')
      .select(SPEC_COLUMNS)
      .eq('is_active', true)
      .in('id', equipmentIds);
    if (specError) throw queryError('specs da comparação', specError);

    const specs = (specData ?? []) as unknown as LegacySpecRow[];
    const activeIds = new Set(specs.map((spec) => spec.id));
    return {
      specs,
      associations: associations.filter((row) => activeIds.has(row.equipment_id)),
    };
  }
}
