import { describe, expect, it } from 'vitest';

import { hasRole } from '../src/auth/access-control';
import type { AuthProfile } from '@compra-car/contracts';

function profile(role: AuthProfile['role']): AuthProfile {
  return { id: 'sample', fullName: null, role, status: 'active' };
}

describe('public signup role boundaries', () => {
  it('allows public identity to satisfy public requirement only', () => {
    expect(hasRole(profile('public'), 'public')).toBe(true);
    expect(hasRole(profile('public'), 'seller')).toBe(false);
    expect(hasRole(profile('public'), 'admin')).toBe(false);
  });
  it('retains seller and admin privileges', () => {
    expect(hasRole(profile('seller'), 'seller')).toBe(true);
    expect(hasRole(profile('seller'), 'admin')).toBe(false);
    expect(hasRole(profile('admin'), 'seller')).toBe(true);
    expect(hasRole(profile('admin'), 'admin')).toBe(true);
  });
});
