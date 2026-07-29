import type {
  ManualPriceBatchRepository,
  ManualPriceBatchRowInput,
  NormalizedManualPriceBatchRow,
} from '../src';
import {
  canonicalManualPriceAmount,
  CreateManualPriceBatch,
  validateManualPriceBatch,
} from '../src';
import { describe, expect, it, vi } from 'vitest';

const validRow: ManualPriceBatchRowInput = {
  clientRowId: 'row-1',
  productId: '42',
  amount: '200.000,25',
  startsOn: '2026-08-01',
  endsOn: null,
};

function repository(): ManualPriceBatchRepository {
  return {
    listProductOptions: vi.fn(async () => []),
    createManualPriceBatch: vi.fn(
      async ({ rows }: { readonly rows: readonly NormalizedManualPriceBatchRow[] }) => ({
        batchId: '90',
        createdCount: rows.length,
        priceIds: rows.map((_, index) => String(100 + index)),
        rows: rows.map((row, index) => ({
          clientRowId: row.clientRowId,
          importRowId: String(200 + index),
          priceId: String(100 + index),
        })),
      }),
    ),
  };
}

describe('manual price batch', () => {
  it.each([
    ['200000', '200000.00'],
    ['200000,00', '200000.00'],
    ['200.000', '200000.00'],
    ['200.000,07', '200000.07'],
    ['R$ 1.234,56', '1234.56'],
  ])('normalizes pt-BR money without floating point: %s', (input, expected) => {
    expect(canonicalManualPriceAmount(input)).toBe(expected);
  });

  it.each(['', '0', '0,00', '-1', '1,234', '1.2.3', 'R$ -10,00'])(
    'rejects invalid or non-positive money: %s',
    (amount) => {
      expect(canonicalManualPriceAmount(amount)).toBeNull();
    },
  );

  it('validates one row and ignores a fully empty operational row', () => {
    expect(
      validateManualPriceBatch({
        rows: [
          validRow,
          { clientRowId: 'placeholder', productId: '', amount: '', startsOn: '', endsOn: '' },
        ],
      }),
    ).toEqual({
      ok: true,
      rows: [{ ...validRow, amount: '200000.25' }],
    });
  });

  it('normalizes multiple rows deterministically and preserves cents as strings', async () => {
    const target = repository();
    const input = {
      rows: [
        validRow,
        {
          ...validRow,
          clientRowId: 'row-2',
          productId: '43',
          amount: '999,01',
          startsOn: '2026-09-01',
        },
      ],
    };
    await expect(
      new CreateManualPriceBatch(target).execute(input, {
        actorId: 'server-actor',
        correlationId: 'server-correlation',
      }),
    ).resolves.toMatchObject({ ok: true, batch: { createdCount: 2, priceIds: ['100', '101'] } });
    expect(target.createManualPriceBatch).toHaveBeenCalledWith({
      rows: [
        { ...validRow, amount: '200000.25' },
        {
          ...validRow,
          clientRowId: 'row-2',
          productId: '43',
          amount: '999.01',
          startsOn: '2026-09-01',
        },
      ],
      actorId: 'server-actor',
      correlationId: 'server-correlation',
    });
    expect(typeof vi.mocked(target.createManualPriceBatch).mock.calls[0]![0].rows[0]!.amount).toBe(
      'string',
    );
  });

  it('rejects empty, partial and over-limit batches before repository access', async () => {
    expect(validateManualPriceBatch({ rows: [] })).toMatchObject({
      ok: false,
      code: 'EMPTY_BATCH',
    });
    expect(validateManualPriceBatch({ rows: [{ ...validRow, amount: '' }] })).toMatchObject({
      ok: false,
      code: 'INVALID_ROWS',
      issues: [expect.objectContaining({ clientRowId: 'row-1', code: 'PARTIAL_ROW' })],
    });
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...validRow,
      clientRowId: `row-${index}`,
      productId: String(index + 1),
      startsOn: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    }));
    expect(validateManualPriceBatch({ rows })).toMatchObject({
      ok: false,
      code: 'BATCH_LIMIT_EXCEEDED',
    });
  });

  it('associates structural, money, date, period and duplicate errors with client rows', () => {
    const result = validateManualPriceBatch({
      rows: [
        validRow,
        { ...validRow, clientRowId: 'duplicate', amount: '100' },
        { ...validRow, clientRowId: 'bad-product', productId: 'nope' },
        { ...validRow, clientRowId: 'bad-start', productId: '44', startsOn: '2026-02-30' },
        {
          ...validRow,
          clientRowId: 'bad-end',
          productId: '45',
          startsOn: '2026-09-01',
          endsOn: '2026-08-31',
        },
        { ...validRow, clientRowId: 'invalid-end', productId: '46', endsOn: '2026-13-01' },
        { ...validRow, clientRowId: 'zero', productId: '47', amount: '0' },
        { ...validRow, clientRowId: 'negative', productId: '48', amount: '-1' },
        { ...validRow, clientRowId: 'row-1', productId: '49', startsOn: '2026-10-01' },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_ROWS' });
    if (result.ok) throw new Error('Expected validation errors.');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clientRowId: 'duplicate', code: 'DUPLICATE_ROW' }),
        expect.objectContaining({ clientRowId: 'bad-product', code: 'INVALID_PRODUCT' }),
        expect.objectContaining({ clientRowId: 'bad-start', code: 'INVALID_START_DATE' }),
        expect.objectContaining({ clientRowId: 'bad-end', code: 'INVALID_PERIOD' }),
        expect.objectContaining({ clientRowId: 'invalid-end', code: 'INVALID_END_DATE' }),
        expect.objectContaining({ clientRowId: 'zero', code: 'INVALID_AMOUNT' }),
        expect.objectContaining({ clientRowId: 'negative', code: 'INVALID_AMOUNT' }),
        expect.objectContaining({ clientRowId: 'row-1', code: 'INVALID_CLIENT_ROW_ID' }),
      ]),
    );
  });
});
