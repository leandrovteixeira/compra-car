import type { AuthProfile } from '@compra-car/adapter-supabase';
import { describe, expect, it } from 'vitest';

import { canAccessArea, hasRole } from '../src/auth/access-control';

function profile(role: AuthProfile['role'], status: AuthProfile['status'] = 'active'): AuthProfile {
  return { id: 'user-id', fullName: null, role, status };
}

describe('auth access control', () => {
  it('permite seller ativo somente na área seller', () => {
    expect(canAccessArea(profile('seller'), 'seller')).toBe(true);
    expect(canAccessArea(profile('seller'), 'admin')).toBe(false);
  });

  it('permite admin ativo nas áreas admin e seller', () => {
    expect(canAccessArea(profile('admin'), 'admin')).toBe(true);
    expect(canAccessArea(profile('admin'), 'seller')).toBe(true);
    expect(hasRole(profile('admin'), 'seller')).toBe(true);
  });

  it('falha fechado para profile ausente, pending, disabled ou role inválida', () => {
    expect(canAccessArea(null, 'seller')).toBe(false);
    expect(canAccessArea(profile('seller', 'pending'), 'seller')).toBe(false);
    expect(canAccessArea(profile('admin', 'disabled'), 'admin')).toBe(false);
    expect(
      canAccessArea({ ...profile('seller'), role: 'unexpected' as AuthProfile['role'] }, 'seller'),
    ).toBe(false);
  });
});
