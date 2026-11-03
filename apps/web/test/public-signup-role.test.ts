import { describe, expect, it } from 'vitest';

import { hasRole } from '../src/auth/access-control';
import { canExecuteFeature, comparisonLimit } from '../src/auth/entitlements-23c';
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

// Product nomenclature: visitor = Public (anonymous), public tier = Free (registered).
describe('Public vs Free product entitlements', () => {
  it('blocks downloads and sharing for anonymous Public users', () => {
    expect(canExecuteFeature('visitor', 'export')).toBe(false);
    expect(canExecuteFeature('visitor', 'share')).toBe(false);
    expect(comparisonLimit('visitor')).toBe(3);
  });
  it('allows exports and sharing for registered Free accounts', () => {
    expect(canExecuteFeature('public', 'export')).toBe(true);
    expect(canExecuteFeature('public', 'share')).toBe(true);
    expect(comparisonLimit('public')).toBe(3);
  });
  it('keeps corporate comparison capacity', () => {
    expect(comparisonLimit('corporate')).toBe(8);
  });
});
