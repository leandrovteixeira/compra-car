import { describe, expect, it } from 'vitest';
import { isPublicPath, requiresAuthentication } from './route-policy';

describe('23C visitor route boundaries', () => {
  it('permits only intended public vehicle pages', () => {
    for (const path of ['/', '/comparar', '/ver-modelo', '/login', '/forgot-password']) {
      expect(isPublicPath(path)).toBe(true);
      expect(requiresAuthentication(path)).toBe(false);
    }
  });
  it('protects export, account and administrative routes', () => {
    for (const path of ['/comparar/pdf', '/admin', '/admin/users', '/conta/perfil', '/conta/upgrade', '/api/admin']) {
      expect(requiresAuthentication(path)).toBe(true);
    }
  });
  it('does not authorize lookalike nested paths', () => {
    expect(requiresAuthentication('/comparar/private')).toBe(true);
    expect(requiresAuthentication('/ver-modelo/secret')).toBe(true);
  });
});
