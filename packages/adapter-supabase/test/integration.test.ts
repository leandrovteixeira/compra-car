import { createVehicleId } from '@compra-car/core';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { LegacySupabaseAdapter } from '../src/legacy-supabase-adapter';

const integrationUrl = process.env.SUPABASE_URL;
const integrationKey = process.env.SUPABASE_SERVER_KEY;
const enabled =
  process.env.RUN_SUPABASE_INTEGRATION_TESTS?.trim().toLowerCase() === 'true' &&
  Boolean(integrationUrl?.trim() && integrationKey?.trim());

function integrationClient() {
  if (!integrationUrl || !integrationKey) {
    throw new Error('Credenciais de integração opt-in ausentes.');
  }

  return createClient(integrationUrl, integrationKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

describe.skipIf(!enabled)('integração read-only com Supabase legado', () => {
  it('consegue selecionar amostras somente das três tabelas autorizadas', async () => {
    const client = integrationClient();
    const projections = {
      products: 'id,brand,model,version,model_year,production_year,is_active,is_public',
      specs:
        'id,code,type,group_name,equipment_group,spec_set,detail,unit,value_direction,is_active',
      product_specs: 'product_id,equipment_id,value,is_present,input_unit',
    } as const;

    for (const [table, columns] of Object.entries(projections)) {
      const { error } = await client.from(table).select(columns).limit(1);
      expect(error, `select em ${table}`).toBeNull();
    }
  });

  it('lista o catálogo público, inclusive quando legitimamente vazio', async () => {
    const adapter = new LegacySupabaseAdapter(integrationClient());
    await expect(adapter.listPublicEligibleVehicles()).resolves.toBeInstanceOf(Array);
    await expect(adapter.listAvailableBrands()).resolves.toBeInstanceOf(Array);
  });

  it('carrega comparação para os IDs opt-in informados', async () => {
    const adapter = new LegacySupabaseAdapter(integrationClient());
    const ids = (process.env.SUPABASE_INTEGRATION_VEHICLE_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map(createVehicleId);

    if (ids.length === 0) return;
    await expect(adapter.getComparisonItemsByVehicleIds(ids)).resolves.toBeInstanceOf(Array);
    await expect(adapter.getComparisonValuesByVehicleIds(ids)).resolves.toBeInstanceOf(Array);
  });
});
