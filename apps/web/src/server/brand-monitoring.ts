import 'server-only';

import { revalidatePath } from 'next/cache';

import type {
  BrandMonitoringActionState,
  MonitoredBrandListItem,
} from '@/application/admin/brand-monitoring';
import { normalizeBrandKey, validateBrandName } from '@/application/admin/brand-monitoring';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { requireRole } from '@/auth/authorization';

interface BrandConnectorTargetRow {
  readonly id: string;
  readonly brand: string;
  readonly brand_key: string;
  readonly market: string;
  readonly origin: 'CATALOG' | 'MANUAL';
}

function toListItem(row: BrandConnectorTargetRow): MonitoredBrandListItem {
  return {
    id: row.id,
    brand: row.brand,
    brandKey: row.brand_key,
    market: row.market,
    origin: row.origin,
  };
}

export async function loadMonitoredBrands(): Promise<readonly MonitoredBrandListItem[]> {
  await requireRole('admin');
  const client = createPrivilegedAdminClient();

  const { data, error } = await client
    .from('brand_connector_targets')
    .select('id, brand, brand_key, market, origin')
    .eq('market', 'BR')
    .eq('enabled', true)
    .order('brand', { ascending: true });

  if (error) throw new Error('Não foi possível carregar as marcas monitoradas.');

  return ((data ?? []) as BrandConnectorTargetRow[]).map(toListItem);
}

export async function createMonitoredBrand(
  _: BrandMonitoringActionState,
  formData: FormData,
): Promise<BrandMonitoringActionState> {
  const { profile } = await requireRole('admin');
  const brand = String(formData.get('brand') ?? '').trim();
  const validationError = validateBrandName(brand);

  if (validationError) return { status: 'error', message: validationError };

  const brandKey = normalizeBrandKey(brand);
  const client = createPrivilegedAdminClient();

  const { data: existing, error: lookupError } = await client
    .from('brand_connector_targets')
    .select('id, brand')
    .eq('market', 'BR')
    .eq('brand_key', brandKey)
    .maybeSingle();

  if (lookupError) {
    return { status: 'error', message: 'Não foi possível validar a marca.' };
  }

  if (existing) {
    return {
      status: 'error',
      message: `${existing.brand} já está cadastrada como marca monitorada.`,
    };
  }

  const { error } = await client.from('brand_connector_targets').insert({
    brand,
    brand_key: brandKey,
    market: 'BR',
    enabled: true,
    origin: 'MANUAL',
    created_by: profile.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: 'Essa marca já está cadastrada.' };
    }

    return { status: 'error', message: 'Não foi possível cadastrar a marca.' };
  }

  revalidatePath('/admin/brands');

  return {
    status: 'success',
    message: `${brand} foi adicionada ao monitoramento.`,
  };
}
