import { LegacySupabaseAdapter, createLegacySupabaseClientFromEnv } from '@compra-car/adapter-supabase';
import type {
  AdministrativeVehicle,
  AdministrativeVehicleFilters,
  AdministrativeVehicleFormValuesDto,
  Vehicle,
} from '@compra-car/contracts';

import { toAdministrativeVehicleFormValues } from '../application/admin/administrative-vehicle-form';
import { matchesVehicleSearch } from '../application/catalog/vehicle-search';

export interface AdminProductListItem {
  readonly brand: string;
  readonly id: string;
  readonly isActive: boolean;
  readonly isPublic: boolean;
  readonly model: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly version: string;
  readonly specifications: 'not_started' | 'filled';
}

export type AdminProductListResult =
  { readonly ok: true; readonly data: readonly AdminProductListItem[] } | { readonly ok: false };

export interface AdminProductReader {
  listAdministrativeVehicles(filters?: AdministrativeVehicleFilters): Promise<readonly Vehicle[]>;
}

export interface AdminProductEditorReader {
  getAdministrativeVehicleById(id: string): Promise<AdministrativeVehicle | null>;
}

function toAdminProductListItem(vehicle: Vehicle, started: ReadonlySet<string>): AdminProductListItem {
  return Object.freeze({
    id: String(vehicle.id),
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    modelYear: vehicle.modelYear,
    productionYear: vehicle.productionYear,
    isActive: vehicle.isActive,
    isPublic: vehicle.isPublic,
    specifications: started.has(String(vehicle.id)) ? 'filled' : 'not_started',
  });
}

export async function loadAdminProductForEditing(
  id: string,
  reader: AdminProductEditorReader = new LegacySupabaseAdapter(),
): Promise<AdministrativeVehicleFormValuesDto | null> {
  const product = await reader.getAdministrativeVehicleById(id);
  return product ? toAdministrativeVehicleFormValues(product) : null;
}

export async function loadAdminProducts(
  filters: AdministrativeVehicleFilters = {},
  reader: AdminProductReader = new LegacySupabaseAdapter(),
  search = '',
  specificationFilter: '' | 'not_started' | 'filled' = '',
): Promise<AdminProductListResult> {
  try {
    const vehicles = await reader.listAdministrativeVehicles(filters);
    const { data: startedRows, error: specsError } = await createLegacySupabaseClientFromEnv()
      .from('vw_admin_product_spec_started').select('product_id');
    if (specsError) throw specsError;
    const started = new Set((startedRows ?? []).map(row => String(row.product_id)));
    // The legacy administrative adapter excludes NULL production_year rows.
    // Agent-created MY products intentionally have no inferred production
    // year; administrators must still be able to find and inspect them.
    const rawMissing = await createLegacySupabaseClientFromEnv()
      .from('products')
      .select('id,brand,model,version,model_year,production_year,is_active,is_public')
      .is('production_year',null)
      .limit(500);
    if(rawMissing.error||!rawMissing.data)throw new Error('ADMIN_PRODUCTS_PENDING_PRODUCTION_YEAR_UNAVAILABLE');
    if(rawMissing.data.length===500)throw new Error('ADMIN_PRODUCTS_PENDING_PRODUCTION_YEAR_LIMIT');
    const pending:AdminProductListItem[]=rawMissing.data
      .filter(row=>row.brand!==null&&row.model!==null&&row.version!==null)
      .filter(row=>(filters.isActive===undefined||row.is_active===filters.isActive)&&
        (filters.isPublic===undefined||row.is_public===filters.isPublic)&&
        (!filters.model||String(row.model).toLocaleLowerCase('pt-BR').includes(filters.model.toLocaleLowerCase('pt-BR')))&&
        (!filters.brand||String(row.brand).toLocaleLowerCase('pt-BR').includes(filters.brand.toLocaleLowerCase('pt-BR')))&&
        (!filters.version||String(row.version).toLocaleLowerCase('pt-BR').includes(filters.version.toLocaleLowerCase('pt-BR'))))
      .map(row=>({
        id:String(row.id),brand:String(row.brand),model:String(row.model),
        version:String(row.version),modelYear:String(row.model_year),
        productionYear:'',isActive:row.is_active===true,isPublic:row.is_public===true,
        specifications:started.has(String(row.id))?'filled':'not_started',
      }));
    const combined=[...vehicles.map(vehicle=>toAdminProductListItem(vehicle,started)),...pending];
    return {
      ok: true,
      data: combined
        .filter((vehicle) =>
          (!specificationFilter || vehicle.specifications === specificationFilter) &&
          matchesVehicleSearch([vehicle.brand, vehicle.model, vehicle.version].join(' '), search),
        )
        .sort(
          (left, right) =>
            left.brand.localeCompare(right.brand, 'pt-BR') ||
            left.model.localeCompare(right.model, 'pt-BR') ||
            left.version.localeCompare(right.version, 'pt-BR'),
        ),
    };
  } catch {
    console.error('Admin product list could not be loaded.');
    return { ok: false };
  }
}
