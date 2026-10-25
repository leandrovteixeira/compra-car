import { describe, expect, it } from 'vitest';
import type { ProductPublicPriceListItemDto } from '@compra-car/contracts';
import { nextPriceSort, readPriceSort, sortPriceRows } from './price-list-sorting';
const price = (
  id: string,
  amount: string,
  endsOn: string | null,
  version: string,
): ProductPublicPriceListItemDto => ({
  id,
  product: { id, brand: 'Marca', model: 'Modelo', version, modelYear: '2027' },
  money: { amount, currencyCode: 'BRL' },
  startsOn: '2026-01-01',
  endsOn,
  status: 'published',
  publishedAt: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  lockVersion: 1,
});
const rows = [price('2', '9000', null, 'Versão 10'), price('1', '10000', '2026-12-01', 'Versão 2')];
describe('instant price sorting', () => {
  it('cycles ascending, descending and default without a fourth state', () => {
    const asc = nextPriceSort(null, 'vehicle');
    expect(asc).toEqual({ field: 'vehicle', direction: 'asc' });
    const desc = nextPriceSort(asc, 'vehicle');
    expect(desc).toEqual({ field: 'vehicle', direction: 'desc' });
    expect(nextPriceSort(desc, 'vehicle')).toBeNull();
    expect(nextPriceSort(desc, 'amount')).toEqual({ field: 'amount', direction: 'asc' });
  });
  it('sorts prices numerically and vehicle labels naturally without mutating input', () => {
    expect(
      sortPriceRows(rows, { field: 'amount', direction: 'asc' }, '2026-10-24').map((p) => p.id),
    ).toEqual(['2', '1']);
    expect(
      sortPriceRows(rows, { field: 'amount', direction: 'desc' }, '2026-10-24').map((p) => p.id),
    ).toEqual(['1', '2']);
    expect(
      sortPriceRows(rows, { field: 'vehicle', direction: 'asc' }, '2026-10-24').map((p) => p.id),
    ).toEqual(['1', '2']);
    expect(rows.map((p) => p.id)).toEqual(['2', '1']);
  });
  it.each(['asc', 'desc'] as const)('keeps open-ended dates last when sorting %s', (direction) => {
    expect(
      sortPriceRows(rows, { field: 'endsOn', direction }, '2026-10-24').map((p) => p.id),
    ).toEqual(['1', '2']);
  });
  it('accepts existing sort URLs and treats missing or invalid fields as default', () => {
    expect(readPriceSort(new URLSearchParams('sort=amount&direction=asc'))).toEqual({
      field: 'amount',
      direction: 'asc',
    });
    expect(readPriceSort(new URLSearchParams())).toBeNull();
    expect(readPriceSort(new URLSearchParams('sort=unknown'))).toBeNull();
  });
});
