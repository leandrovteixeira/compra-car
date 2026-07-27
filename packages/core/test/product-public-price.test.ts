import type { ProductPublicPrice, ProductPublicPriceRepository } from '../src';
import {
  CreateProductPublicPrice,
  ListProductPublicPrices,
  UpdateProductPublicPrice,
  validateProductPublicPriceWriteInput,
} from '../src';
import { describe, expect, it, vi } from 'vitest';

const price: ProductPublicPrice = {
  id: '10',
  product: { id: '20', brand: 'Toyota', model: 'Corolla', version: 'XRX', modelYear: '2026' },
  money: { amount: '159990.00', currencyCode: 'BRL' },
  startsOn: '2026-07-01',
  endsOn: null,
  status: 'draft',
  publishedAt: null,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
  lockVersion: 1,
};

function repository(): ProductPublicPriceRepository {
  return {
    listProductPublicPrices: vi.fn(async () => ({ items: [], total: 51 })),
    createProductPublicPrice: vi.fn(async () => price),
    updateProductPublicPrice: vi.fn(async () => ({ status: 'updated' as const, price })),
  };
}

describe('ProductPublicPrice use cases', () => {
  it('normalizes pagination and returns page metadata', async () => {
    const target = repository();
    await expect(
      new ListProductPublicPrices(target).execute({ page: 2, pageSize: 25 }),
    ).resolves.toEqual({ items: [], total: 51, page: 2, pageSize: 25, pageCount: 3 });
    expect(target.listProductPublicPrices).toHaveBeenCalledWith({ limit: 25, offset: 25 });
  });

  it('creates a validated decimal draft using the server actor', async () => {
    const target = repository();
    await expect(
      new CreateProductPublicPrice(target).execute(
        { productId: '20', amount: '159990', startsOn: '2026-07-01', endsOn: null },
        'actor-id',
      ),
    ).resolves.toEqual({ ok: true, price });
    expect(target.createProductPublicPrice).toHaveBeenCalledWith({
      productId: '20',
      amount: '159990.00',
      startsOn: '2026-07-01',
      endsOn: null,
      actorId: 'actor-id',
    });
  });

  it('validates decimal precision, positivity, dates and lock version', async () => {
    expect(
      validateProductPublicPriceWriteInput({
        productId: '20',
        amount: '10.123',
        startsOn: 'invalid',
        endsOn: '2026-01-01',
      }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { amount: expect.any(Array), startsOn: expect.any(Array) },
    });
    const target = repository();
    const result = await new UpdateProductPublicPrice(target).execute(
      {
        id: '10',
        productId: '20',
        amount: '0',
        startsOn: '2026-07-01',
        endsOn: null,
        lockVersion: 0,
      },
      'actor-id',
    );
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(target.updateProductPublicPrice).not.toHaveBeenCalled();
  });

  it('updates only editable fields with optimistic concurrency and propagates conflict', async () => {
    const target = repository();
    await new UpdateProductPublicPrice(target).execute(
      {
        id: '10',
        productId: '999',
        amount: '249990.50',
        startsOn: '2026-08-01',
        endsOn: '2026-08-31',
        lockVersion: 3,
      },
      'actor-id',
    );
    expect(target.updateProductPublicPrice).toHaveBeenCalledWith({
      id: '10',
      amount: '249990.50',
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
      expectedLockVersion: 3,
      actorId: 'actor-id',
    });
    vi.mocked(target.updateProductPublicPrice).mockResolvedValueOnce({ status: 'conflict' });
    await expect(
      new UpdateProductPublicPrice(target).execute(
        {
          id: '10',
          productId: '20',
          amount: '1.00',
          startsOn: '2026-08-01',
          endsOn: null,
          lockVersion: 3,
        },
        'actor-id',
      ),
    ).resolves.toEqual({ ok: false, code: 'CONFLICT' });
  });
});
