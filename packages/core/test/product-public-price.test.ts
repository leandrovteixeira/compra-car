import type { ProductPublicPriceRepository } from '../src';
import { ListProductPublicPrices } from '../src';
import { describe, expect, it, vi } from 'vitest';

function repository(): ProductPublicPriceRepository {
  return { listProductPublicPrices: vi.fn(async () => ({ items: [], total: 51 })) };
}

describe('ListProductPublicPrices', () => {
  it('normalizes pagination and returns page metadata', async () => {
    const target = repository();
    await expect(
      new ListProductPublicPrices(target).execute({ page: 2, pageSize: 25 }),
    ).resolves.toEqual({ items: [], total: 51, page: 2, pageSize: 25, pageCount: 3 });
    expect(target.listProductPublicPrices).toHaveBeenCalledWith({ limit: 25, offset: 25 });
  });

  it('falls back for invalid values and caps page size', async () => {
    const target = repository();
    await new ListProductPublicPrices(target).execute({ page: 0, pageSize: 1000 });
    expect(target.listProductPublicPrices).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });

  it('defines a read-only repository contract', () => {
    const target = repository() as ProductPublicPriceRepository & Record<string, unknown>;
    expect(Object.keys(target)).toEqual(['listProductPublicPrices']);
  });
});
