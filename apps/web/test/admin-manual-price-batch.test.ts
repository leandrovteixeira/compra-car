import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ManualPriceBatchRepository, NormalizedManualPriceBatchRow } from '@compra-car/core';
import { describe, expect, it, vi } from 'vitest';

import {
  executeManualPriceBatchCreation,
  readManualPriceBatchRows,
  toManualPriceBatchRowErrors,
} from '../src/application/admin/manual-price-batch';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

function repository(): ManualPriceBatchRepository {
  return {
    listProductOptions: vi.fn(async () => []),
    createManualPriceBatch: vi.fn(
      async ({ rows }: { readonly rows: readonly NormalizedManualPriceBatchRow[] }) => ({
        batchId: '90',
        createdCount: rows.length,
        priceIds: rows.map((_, index) => String(index + 1)),
        rows: rows.map((row, index) => ({
          clientRowId: row.clientRowId,
          importRowId: String(index + 10),
          priceId: String(index + 1),
        })),
      }),
    ),
  };
}

function form(rows: unknown, actorId?: string): FormData {
  const value = new FormData();
  value.set('rows', JSON.stringify(rows));
  if (actorId) value.set('actorId', actorId);
  return value;
}

const row = {
  clientRowId: 'row-1',
  productId: '42',
  amount: '200.000,25',
  startsOn: '2026-08-01',
  endsOn: '',
};

describe('admin manual price batch', () => {
  it('produz DTO de erros com protÃ³tipos plain serializÃ¡veis pelo React', () => {
    const errors = toManualPriceBatchRowErrors([
      {
        clientRowId: 'row-1',
        rowNumber: 1,
        field: 'amount',
        code: 'INVALID_AMOUNT',
        message: 'InvÃ¡lido',
      },
    ]);
    expect(Object.getPrototypeOf(errors)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(errors['row-1'])).toBe(Object.prototype);
    expect(errors).toEqual({ 'row-1': { amount: ['InvÃ¡lido'] } });
  });

  it('rejects malformed browser payloads after authorization and preserves safe feedback', async () => {
    const authorize = vi.fn(async () => ({ actorId: 'server-actor' }));
    const invalid = new FormData();
    invalid.set('rows', '{invalid');
    await expect(
      executeManualPriceBatchCreation(invalid, {
        authorize,
        createRepository: repository,
        createCorrelationId: () => 'server-correlation',
        conflictRowIds: () => null,
        revalidate: vi.fn(),
      }),
    ).resolves.toMatchObject({ status: 'error', message: expect.not.stringContaining('invalid') });
    expect(authorize).toHaveBeenCalledOnce();
    expect(readManualPriceBatchRows(invalid)).toBeNull();
  });

  it('uses only the profile actor and server correlation, then revalidates both routes', async () => {
    const target = repository();
    const revalidate = vi.fn();
    await expect(
      executeManualPriceBatchCreation(form([row], 'browser-forged-actor'), {
        authorize: vi.fn(async () => ({ actorId: 'profile-actor' })),
        createRepository: () => target,
        createCorrelationId: () => 'server-correlation',
        conflictRowIds: () => null,
        revalidate,
      }),
    ).resolves.toMatchObject({ status: 'success', createdCount: 1, rows: [{ productId: '' }] });
    expect(target.createManualPriceBatch).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'profile-actor', correlationId: 'server-correlation' }),
    );
    expect(target.createManualPriceBatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'browser-forged-actor' }),
    );
    expect(revalidate).toHaveBeenCalledWith('/admin/prices');
    expect(revalidate).toHaveBeenCalledWith('/admin/prices/input');
  });

  it('associates validation and persistence conflicts with rows while preserving submitted values', async () => {
    const dependencies = {
      authorize: vi.fn(async () => ({ actorId: 'profile-actor' })),
      createRepository: repository,
      createCorrelationId: () => 'server-correlation',
      conflictRowIds: () => null as readonly string[] | null,
      revalidate: vi.fn(),
    };
    await expect(
      executeManualPriceBatchCreation(form([{ ...row, amount: '' }]), dependencies),
    ).resolves.toMatchObject({
      status: 'error',
      rows: [{ clientRowId: 'row-1', amount: '' }],
      rowErrors: { 'row-1': { row: expect.any(Array) } },
    });

    const failedRepository = repository();
    vi.mocked(failedRepository.createManualPriceBatch).mockRejectedValue(
      new Error('private DB detail'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      executeManualPriceBatchCreation(form([row]), {
        ...dependencies,
        createRepository: () => failedRepository,
        conflictRowIds: () => ['row-1'],
      }),
    ).resolves.toMatchObject({
      status: 'conflict',
      rows: [row],
      rowErrors: { 'row-1': { row: expect.any(Array) } },
      message: expect.not.stringContaining('private DB detail'),
    });
  });

  it('keeps the protected server-rendered route and interactive accessible responsive grid', () => {
    const page = source('../src/app/admin/prices/input/page.tsx');
    const action = source('../src/app/admin/prices/input/actions.ts');
    const grid = source('../src/components/admin/admin-price-batch-grid.tsx');
    const listPage = source('../src/app/admin/prices/page.tsx');
    const adapter = source(
      '../../../packages/adapter-supabase/src/manual-price-batch-supabase-adapter.ts',
    );

    expect(page).toContain("await requireRole('admin')");
    expect(page).toContain('<AdminPriceBatchGrid');
    expect(page).toContain('href="/admin/prices"');
    expect(page).not.toContain('supabase');
    expect(action).toContain("'use server'");
    expect(listPage).toContain('href="/admin/prices/input"');
    expect(grid).toContain("'use client'");
    expect(grid).toContain('rows: [EMPTY_MANUAL_PRICE_BATCH_ROW]');
    expect(grid).toContain('next.push(newEmptyRow');
    expect(grid).toContain('removeRow(row.clientRowId)');
    expect(grid).toContain('disabled={isLastEmpty}');
    expect(grid).toContain('disabled={pending || filledCount === 0}');
    expect(grid).toContain('md:grid-cols-');
    expect(grid).toContain('hidden min-h-8 grid-cols-');
    expect(grid).not.toContain('admin-table-header');
    expect(grid).toContain('aria-live="polite"');
    expect(grid).toContain('Salvar preços');
    expect(action).toContain('JSON.parse(JSON.stringify(result))');
    expect(grid).toContain('type="date"');
    expect(grid).toContain('inputMode="decimal"');
    expect(grid).toContain('formatPtBrMoneyInput');
    expect(grid).toContain('<AdminProductCombobox');
    expect(adapter).toContain(".from('products')");
    expect(adapter).not.toContain('LegacySupabaseAdapter');
  });
});
