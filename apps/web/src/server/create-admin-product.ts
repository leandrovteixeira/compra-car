import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import {
  executeAdminProductCreation as executeCreation,
  type CreateAdminProductDependencies,
} from '@/application/admin/create-admin-product';
import { requireRole } from '@/auth/authorization';
import { loadExistingCatalogBrands } from '@/server/admin-catalog-brands';

const defaultDependencies: CreateAdminProductDependencies = {
  authorize: () => requireRole('admin'),
  createRepository: () => new LegacySupabaseAdapter(),
  revalidate: revalidatePath,
};

export async function executeAdminProductCreation(
  formData: FormData,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  const brand = String(formData.get('brand') ?? '').trim();
  const brands = await loadExistingCatalogBrands();
  if (!brands.includes(brand)) {
    return {
      status: 'error',
      values: {
        brand,
        model: String(formData.get('model') ?? ''),
        version: String(formData.get('version') ?? ''),
        modelYear: String(formData.get('modelYear') ?? ''),
        productionYear: String(formData.get('productionYear') ?? ''),
        isActive: false,
        isPublic: false,
      },
      fieldErrors: { brand: ['Selecione uma marca já cadastrada.'] },
    };
  }
  return executeCreation(formData, defaultDependencies);
}
