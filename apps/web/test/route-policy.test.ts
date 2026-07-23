import { describe, expect, it } from 'vitest';

import { isPublicPath, requiresAuthentication } from '../src/auth/route-policy';

describe('route policy', () => {
  it('mantém apenas login como route pública da aplicação', () => {
    expect(isPublicPath('/login')).toBe(true);
  });

  it.each(['/', '/comparar', '/admin'])('exige autenticação em %s', (pathname) => {
    expect(requiresAuthentication(pathname)).toBe(true);
  });
});
