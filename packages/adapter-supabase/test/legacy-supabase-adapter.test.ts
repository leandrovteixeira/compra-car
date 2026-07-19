import { createVehicleId } from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { LegacySupabaseAdapter } from '../src/legacy-supabase-adapter';

interface FakeResponse {
  readonly data: readonly unknown[] | null;
  readonly error: null;
}

interface FakeCall {
  readonly table: string;
  readonly operations: string[];
}

class FakeQuery implements PromiseLike<FakeResponse> {
  constructor(
    private readonly response: FakeResponse,
    readonly call: FakeCall,
  ) {}

  select(columns: string): this {
    this.call.operations.push(`select:${columns}`);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.call.operations.push(`eq:${column}:${String(value)}`);
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.call.operations.push(`in:${column}:${values.join(',')}`);
    return this;
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function fakeClient(responses: Readonly<Record<string, readonly (readonly unknown[])[]>>): {
  readonly client: SupabaseClient;
  readonly calls: FakeCall[];
} {
  const calls: FakeCall[] = [];
  const offsets = new Map<string, number>();
  const client = {
    from(table: string) {
      const offset = offsets.get(table) ?? 0;
      offsets.set(table, offset + 1);
      const call = { table, operations: [] };
      calls.push(call);
      return new FakeQuery({ data: responses[table]?.[offset] ?? [], error: null }, call);
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const product = {
  id: 1,
  brand: 'Marca',
  model: 'Modelo',
  version: 'Versão',
  model_year: 2026,
  production_year: 2025,
  is_active: true,
  is_public: true,
};

describe('LegacySupabaseAdapter', () => {
  it('aceita catálogo público vazio sem consultar associações', async () => {
    const { client, calls } = fakeClient({ products: [[]] });
    const adapter = new LegacySupabaseAdapter(client);

    await expect(adapter.listPublicEligibleVehicles()).resolves.toEqual([]);
    expect(calls.map((call) => call.table)).toEqual(['products']);
  });

  it('não torna elegível veículo sem associação válida com spec ativa', async () => {
    const { client } = fakeClient({
      products: [[product]],
      product_specs: [[{ product_id: 1, equipment_id: 10 }]],
      specs: [[]],
    });
    const adapter = new LegacySupabaseAdapter(client);

    await expect(adapter.listAvailableVehicles()).resolves.toEqual([]);
  });

  it('lista somente veículo público elegível e aplica os dois filtros distintos', async () => {
    const { client, calls } = fakeClient({
      products: [[product]],
      product_specs: [[{ product_id: 1, equipment_id: 10 }]],
      specs: [[{ id: 10 }]],
    });
    const adapter = new LegacySupabaseAdapter(client);

    await expect(
      adapter.listAvailableVehicles({ brand: 'Marca', model: 'Modelo' }),
    ).resolves.toEqual([expect.objectContaining({ id: '1', isActive: true, isPublic: true })]);
    expect(calls[0]?.operations).toEqual(
      expect.arrayContaining([
        'eq:is_active:true',
        'eq:is_public:true',
        'eq:brand:Marca',
        'eq:model:Modelo',
      ]),
    );
    expect(new Set(calls.map((call) => call.table))).toEqual(
      new Set(['products', 'product_specs', 'specs']),
    );
  });

  it('preserva a ordem dos IDs solicitados', async () => {
    const second = { ...product, id: 2, version: 'Versão 2' };
    const { client } = fakeClient({ products: [[product, second]] });
    const adapter = new LegacySupabaseAdapter(client);

    const vehicles = await adapter.getVehiclesByIds([createVehicleId('2'), createVehicleId('1')]);
    expect(vehicles.map((vehicle) => vehicle.id)).toEqual(['2', '1']);
  });

  it('compartilha o lote concorrente de comparação e evita N+1', async () => {
    const association = {
      product_id: 1,
      equipment_id: 10,
      value: null,
      is_present: true,
      input_unit: null,
    };
    const spec = {
      id: 10,
      code: 'safety.abs',
      type: 'binary',
      group_name: 'Segurança',
      equipment_group: 'Freios',
      spec_set: 'ABS',
      detail: 'Freios ABS',
      unit: null,
      is_active: true,
    };
    const { client, calls } = fakeClient({
      product_specs: [[association]],
      specs: [[spec]],
    });
    const adapter = new LegacySupabaseAdapter(client);
    const ids = [createVehicleId('1'), createVehicleId('2')];

    const [items, values] = await Promise.all([
      adapter.getComparisonItemsByVehicleIds(ids),
      adapter.getComparisonValuesByVehicleIds(ids),
    ]);

    expect(items).toHaveLength(1);
    expect(values).toHaveLength(2);
    expect(calls.map((call) => call.table)).toEqual(['product_specs', 'specs']);
  });
});
