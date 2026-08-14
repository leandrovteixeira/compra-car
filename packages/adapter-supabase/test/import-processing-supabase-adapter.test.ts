import type { ProductMatchInput } from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { PricingAdapterQueryError } from '../src/errors';
import {
  ImportProcessingSupabaseAdapter,
  IMPORT_MATCH_QUERY_CHUNK_SIZE,
} from '../src/import-processing-supabase-adapter';

type QueryResult = { data: unknown; error: unknown };

function queryClient(resolve: (filters: readonly string[]) => Promise<QueryResult> | QueryResult) {
  const queries: string[][] = [];
  let active = 0;
  let maxActive = 0;
  const from = vi.fn(() => {
    const filters: string[] = [];
    queries.push(filters);
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((field: string, value: unknown) => {
        filters.push(`eq:${field}:${String(value)}`);
        return query;
      }),
      ilike: vi.fn((field: string, value: string) => {
        filters.push(`ilike:${field}:${value}`);
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      then: async (
        fulfilled: (value: QueryResult) => unknown,
        rejected: (reason: unknown) => unknown,
      ) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          return await fulfilled(await resolve(filters));
        } catch (error) {
          return rejected(error);
        } finally {
          active -= 1;
        }
      },
    };
    return query;
  });
  return {
    client: { from } as unknown as SupabaseClient,
    queries,
    maxActive: () => maxActive,
  };
}

const input = (index = 0): ProductMatchInput => ({
  brand: ' Fiat ',
  model: `Modelo ${index}`,
  version: `Versão ${index}`,
  modelYear: '2026',
  productionYear: '2025',
});

const product = (index = 0) => ({
  id: index + 1,
  brand: 'Fiat',
  model: `Modelo ${index}`,
  version: `Versão ${index}`,
  model_year: 2026,
  production_year: 2025,
});

describe('ImportProcessingSupabaseAdapter matching', () => {
  it('queries a complete exact business key with normalized strings and numeric years', async () => {
    const target = queryClient(() => ({ data: [product()], error: null }));
    await expect(
      new ImportProcessingSupabaseAdapter(target.client).findMatchCandidates(input()),
    ).resolves.toMatchObject([{ id: '1', brand: 'Fiat', modelYear: '2026' }]);
    expect(target.queries).toEqual([
      expect.arrayContaining([
        'ilike:brand:Fiat',
        'ilike:model:Modelo 0',
        'ilike:version:Versão 0',
        'eq:model_year:2026',
        'eq:production_year:2025',
      ]),
    ]);
  });

  it.each([
    ['', ''],
    ['2026', ''],
    ['', '2025'],
    ['2026/2027', '2025'],
  ])('skips exact year filters for incomplete key %s/%s', async (modelYear, productionYear) => {
    const target = queryClient(() => ({ data: [], error: null }));
    await new ImportProcessingSupabaseAdapter(target.client).findMatchCandidates({
      ...input(),
      modelYear,
      productionYear,
    });
    expect(target.queries).toHaveLength(1);
    expect(target.queries[0]).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^eq:(model_year|production_year):/u)]),
    );
  });

  it('uses parameterized filters and escapes only ILIKE wildcard characters', async () => {
    const target = queryClient(() => ({ data: [], error: null }));
    await new ImportProcessingSupabaseAdapter(target.client).findMatchCandidates({
      ...input(),
      model: ' 500%_ (Abarth), 1.0-T ',
      modelYear: '',
      productionYear: '',
    });
    expect(target.queries[0]).toContain('ilike:model:%500\\%\\_ (Abarth), 1.0-T%');
  });

  it('deduplicates keys and bounds 100 directed queries in predictable chunks', async () => {
    const target = queryClient(async (filters) => {
      await Promise.resolve();
      const model = filters.find((filter) => filter.startsWith('ilike:model:'))?.split(':')[2];
      const index = Number(model?.replace('Modelo ', ''));
      return { data: [product(index)], error: null };
    });
    const adapter = new ImportProcessingSupabaseAdapter(target.client);
    const inputs = Array.from({ length: 100 }, (_, index) => input(index));
    const result = await adapter.findMatchCandidatesBatch([...inputs, input(0)]);
    expect(result).toHaveLength(101);
    expect(result[0]).toEqual(result[100]);
    expect(target.queries).toHaveLength(100);
    expect(target.maxActive()).toBeLessThanOrEqual(IMPORT_MATCH_QUERY_CHUNK_SIZE);
  });

  it('fails the whole batch and does not start later chunks after one chunk fails', async () => {
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;
    const target = queryClient(() => {
      calls += 1;
      return calls === 3
        ? {
            data: null,
            error: { status: 400, code: '22P02', message: 'invalid input\nAuthorization: secret' },
          }
        : { data: [product(calls)], error: null };
    });
    await expect(
      new ImportProcessingSupabaseAdapter(target.client).findMatchCandidatesBatch(
        Array.from({ length: IMPORT_MATCH_QUERY_CHUNK_SIZE + 1 }, (_, index) => input(index)),
      ),
    ).rejects.toBeInstanceOf(PricingAdapterQueryError);
    expect(target.queries).toHaveLength(IMPORT_MATCH_QUERY_CHUNK_SIZE);
    expect(diagnostic).toHaveBeenCalledWith(
      'IMPORT_MATCH_QUERY_FAILURE',
      expect.objectContaining({
        operation: 'exact',
        code: '22P02',
        filter: 'brand,model,version,model_year,production_year',
      }),
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('secret');
    diagnostic.mockRestore();
  });

  it('returns zero candidates without converting it into a query failure', async () => {
    const target = queryClient(() => ({ data: [], error: null }));
    await expect(
      new ImportProcessingSupabaseAdapter(target.client).findMatchCandidates(input()),
    ).resolves.toEqual([]);
    expect(target.queries).toHaveLength(2);
  });
});
