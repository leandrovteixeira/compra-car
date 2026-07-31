export interface AdminPriceQuery {
  readonly page?: string | readonly string[];
  readonly sort?: string | readonly string[];
  readonly direction?: string | readonly string[];
}

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' || value === undefined ? value : value[0];
}

export function parseAdminPricePage(query: AdminPriceQuery): number {
  const value = first(query.page);
  if (!value || !/^\d+$/u.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

const SORTS = ['vehicle', 'amount', 'startsOn', 'status', 'publishedAt', 'updatedAt'] as const;
export function parseAdminPriceSort(query: AdminPriceQuery) {
  const sortValue = first(query.sort);
  const sort = SORTS.find((candidate) => candidate === sortValue) ?? 'updatedAt';
  const direction = first(query.direction) === 'asc' ? 'asc' : 'desc';
  return { sort, direction } as const;
}
