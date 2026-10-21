import { describe, expect, it } from 'vitest';
import { isPublicPath, requiresAuthentication } from './route-policy';

describe('Sprint 23C public route policy', () => {
  it('allows visitor vehicle pages', () => {
    for (const path of ['/', '/ver-modelo', '/comparar']) {
      expect(isPublicPath(path)).toBe(true);
      expect(requiresAuthentication(path)).toBe(false);
    }
  });

  it('keeps export and admin operations authenticated', () => {
    for (const path of ['/comparar/pdf', '/admin/users', '/conta/perfil', '/api/internal']) {
      expect(requiresAuthentication(path)).toBe(true);
    }
  });

  it('does not accidentally allow prefixed lookalike paths', () => {
    expect(requiresAuthentication('/comparar/private')).toBe(true);
    expect(requiresAuthentication('/ver-modelo/admin')).toBe(true);
  });
});
