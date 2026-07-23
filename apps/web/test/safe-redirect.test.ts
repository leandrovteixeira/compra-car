import { describe, expect, it } from 'vitest';

import { getSafeInternalDestination, isAdminDestination } from '../src/auth/safe-redirect';

describe('getSafeInternalDestination', () => {
  it('preserva paths internos com query string', () => {
    expect(getSafeInternalDestination('/comparar?vehicles=1,2')).toBe('/comparar?vehicles=1,2');
  });

  it.each([
    'https://example.com/admin',
    '//example.com/admin',
    '/\\example.com/admin',
    '\\example.com',
    '/%5Cexample.com/admin',
    '/%2F%2Fexample.com/admin',
    '/%255Cexample.com/admin',
    '/%252F%252Fexample.com/admin',
    '/%E0%A4%A',
    'javascript:alert(1)',
    'admin',
  ])('rejeita destino externo ou malformado: %s', (destination) => {
    expect(getSafeInternalDestination(destination)).toBe('/');
  });

  it('reconhece somente o segmento admin', () => {
    expect(isAdminDestination('/admin')).toBe(true);
    expect(isAdminDestination('/admin/products?active=true')).toBe(true);
    expect(isAdminDestination('/administrator')).toBe(false);
    expect(isAdminDestination('/administer')).toBe(false);
  });
});
