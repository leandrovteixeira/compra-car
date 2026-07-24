import type {
  AdministrativeVehicle,
  AdministrativeVehicleInput,
  AdministrativeVehicleFilters,
  AdministrativeVehicleRepository,
  AvailableVehicleFilters,
  ComparisonItem,
  ComparisonRepository,
  Vehicle,
  VehicleComparisonValue,
  VehicleId,
  VehicleRepository,
} from '@compra-car/core';
import { administrativeVehicleIdentity } from '@compra-car/core';
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

function escapedIlikeContains(value: string): string {
  return `%${value.replace(/[\\%_]/gu, '\\$&')}%`;
}

interface ComparisonBatch {
  readonly specs: readonly LegacySpecRow[];
  readonly associations: readonly LegacyProductSpecRow[];
}

function queryError(operation: string, error: PostgrestError): LegacyAdapterQueryError {
  return new LegacyAdapterQueryError(`Falha ao consultar dados legados (${operation}).`, {
    cause: error,
  });
}

function parseLegacyId(id: VehicleId | string): number {
  const parsed = Number(String(id));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new LegacyAdapterMappingError(`VehicleId incompatível com products.id: ${String(id)}.`);
  }
  return parsed;
}

function parseAdministrativeProductId(id: string): number | null {
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function mapLegacyProductToAdministrativeVehicle(row: LegacyProductRow): AdministrativeVehicle {
  if (row.brand === null || row.model === null || row.version === null) {
    throw new LegacyAdapterMappingError(
      `Product administrativo ${row.id} possui identidade incompleta.`,
    );
  }
  return {
    id: String(row.id),
    brand: row.brand,
    model: row.model,
    version: row.version,
    modelYear: Number(row.model_year),
    productionYear: Number(row.production_year),
    isActive: row.is_active === true,
    isPublic: row.is_public === true,
  };
}

export class LegacySupabaseAdapter
  implements VehicleRepository, ComparisonRepository, AdministrativeVehicleRepository
{
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

  async listAdministrativeVehicles(
    filters: AdministrativeVehicleFilters = {},
  ): Promise<readonly Vehicle[]> {
    let query = this.client.from('products').select(PRODUCT_COLUMNS);
    if (filters.model) query = query.ilike('model', escapedIlikeContains(filters.model));
    if (filters.brand) query = query.ilike('brand', escapedIlikeContains(filters.brand));
    if (filters.version) query = query.ilike('version', escapedIlikeContains(filters.version));
    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);
    if (filters.isPublic !== undefined) query = query.eq('is_public', filters.isPublic);

    const { data, error } = await query;
    if (error) throw queryError('products administrativos', error);

    return ((data ?? []) as unknown as LegacyProductRow[]).map(mapLegacyProductToVehicle);
  }

  async findAdministrativeVehicleDuplicate(
    input: AdministrativeVehicleInput,
    excludeId?: string,
  ): Promise<boolean> {
    let query = this.client
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('model_year', input.modelYear)
      .eq('production_year', input.productionYear);
    if (excludeId !== undefined) query = query.neq('id', parseLegacyId(excludeId));

    const { data, error } = await query;
    if (error) throw queryError('duplicidade de product', error);

    const identity = administrativeVehicleIdentity(input);
    return ((data ?? []) as unknown as LegacyProductRow[]).some((row) => {
      if (row.brand === null || row.model === null || row.version === null) return false;
      return (
        administrativeVehicleIdentity({
          brand: row.brand,
          model: row.model,
          version: row.version,
          modelYear: Number(row.model_year),
          productionYear: Number(row.production_year),
          isActive: row.is_active === true,
          isPublic: row.is_public === true,
        }) === identity
      );
    });
  }

  async getAdministrativeVehicleById(id: string): Promise<AdministrativeVehicle | null> {
    const productId = parseAdministrativeProductId(id);
    if (productId === null) return null;
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('id', productId)
      .maybeSingle();
    if (error) throw queryError('product administrativo por id', error);
    return data
      ? mapLegacyProductToAdministrativeVehicle(data as unknown as LegacyProductRow)
      : null;
  }

  async createAdministrativeVehicle(
    input: AdministrativeVehicleInput,
  ): Promise<
    { readonly status: 'created'; readonly id: string } | { readonly status: 'duplicate' }
  > {
    const payload = {
      brand: input.brand,
      model: input.model,
      version: input.version,
      model_year: input.modelYear,
      production_year: input.productionYear,
      is_active: input.isActive,
      is_public: input.isPublic,
    };
    const { data, error } = await this.client
      .from('products')
      .insert(payload)
      .select('id')
      .single();

    if (error?.code === '23505') return { status: 'duplicate' };
    if (error) throw queryError('criação de product', error);

    const id = (data as { readonly id?: unknown } | null)?.id;
    if (typeof id !== 'number' && typeof id !== 'string') {
      throw new LegacyAdapterMappingError('A criação de product não retornou um ID válido.');
    }
    return { status: 'created', id: String(id) };
  }

  async updateAdministrativeVehicle(
    id: string,
    input: AdministrativeVehicleInput,
  ): Promise<
    | { readonly status: 'updated' }
    | { readonly status: 'not_found' }
    | { readonly status: 'duplicate' }
  > {
    const productId = parseAdministrativeProductId(id);
    if (productId === null) return { status: 'not_found' };
    const payload = {
      brand: input.brand,
      model: input.model,
      version: input.version,
      model_year: input.modelYear,
      production_year: input.productionYear,
      is_active: input.isActive,
      is_public: input.isPublic,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from('products')
      .update(payload)
      .eq('id', productId)
      .select('id')
      .maybeSingle();

    if (error?.code === '23505') return { status: 'duplicate' };
    if (error) throw queryError('atualização de product', error);
    return data ? { status: 'updated' } : { status: 'not_found' };
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
