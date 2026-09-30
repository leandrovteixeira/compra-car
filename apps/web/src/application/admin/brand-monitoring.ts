export interface MonitoredBrandListItem {
  readonly id: string;
  readonly brand: string;
  readonly brandKey: string;
  readonly market: string;
  readonly origin: 'CATALOG' | 'MANUAL';
}

export type BrandMonitoringActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly message: string }
  | { readonly status: 'error'; readonly message: string };

export function normalizeBrandKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateBrandName(value: string): string | null {
  const brand = value.trim();

  if (!brand) return 'Informe o nome da marca.';
  if (brand.length > 100) return 'O nome da marca deve ter no máximo 100 caracteres.';
  if (!normalizeBrandKey(brand)) return 'Informe um nome de marca válido.';

  return null;
}
