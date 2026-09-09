import 'server-only';
import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { AdministrativeVehicle, CommercialOperatorCatalogReader } from '@compra-car/core';

export type OperatorCatalogResult =
  | { readonly ok: true; readonly products: readonly AdministrativeVehicle[] }
  | { readonly ok: false; readonly message: string };

export async function loadCommercialOperatorCatalog(
  reader?: CommercialOperatorCatalogReader,
): Promise<OperatorCatalogResult> {
  try {
    return {
      ok: true,
      products: await (reader ?? new LegacySupabaseAdapter()).listOperatorMatchingProducts(),
    };
  } catch {
    console.error('[structured-policies] Operator catalog read failed');
    return { ok: false, message: 'Não foi possível carregar o catálogo. Tente novamente.' };
  }
}
