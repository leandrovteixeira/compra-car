import type { ProductPublicPriceListItemDto } from '@compra-car/contracts';
import { adminPriceVisualStatusLabel } from './admin-price-presentation';

export const priceSortLabels = {
  vehicle: 'Veículo',
  amount: 'Preço público',
  startsOn: 'Vigência De',
  endsOn: 'Vigência Até',
  status: 'Status',
  updatedAt: 'Atualizado em',
  publishedAt: 'Publicado em',
} as const;
export type PriceSortField = keyof typeof priceSortLabels;
export interface PriceSort {
  readonly field: PriceSortField;
  readonly direction: 'asc' | 'desc';
}
export const defaultAdminPriceSort: PriceSort = { field: 'updatedAt', direction: 'desc' };
export const defaultPublicPriceSort: PriceSort = { field: 'vehicle', direction: 'asc' };
export function nextPriceSort(sort: PriceSort | null, field: PriceSortField): PriceSort | null {
  if (sort?.field !== field) return { field, direction: 'asc' };
  return sort.direction === 'asc' ? { field, direction: 'desc' } : null;
}
export function readPriceSort(params: Pick<URLSearchParams, 'get'>): PriceSort | null {
  const field = params.get('sort');
  return field && Object.hasOwn(priceSortLabels, field)
    ? {
        field: field as PriceSortField,
        direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
      }
    : null;
}
export function sortPriceRows(
  items: readonly ProductPublicPriceListItemDto[],
  sort: PriceSort,
  today: string,
) {
  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  const value = (p: ProductPublicPriceListItemDto): string | number | null => {
    switch (sort.field) {
      case 'vehicle':
        return [p.product.brand, p.product.model, p.product.version, p.product.modelYear].join(' ');
      case 'amount':
        return Number(p.money.amount);
      case 'status':
        return adminPriceVisualStatusLabel(p.status, p.startsOn, p.endsOn, today);
      default:
        return p[sort.field];
    }
  };
  return [...items].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    // Open-ended dates always follow dated values, in either direction.
    if (av === null) return bv === null ? collator.compare(a.id, b.id) : 1;
    if (bv === null) return -1;
    const c =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : collator.compare(String(av), String(bv));
    return c * (sort.direction === 'asc' ? 1 : -1) || collator.compare(a.id, b.id);
  });
}
