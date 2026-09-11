import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AuthProfile } from '@compra-car/adapter-supabase';

import { canAccessArea, hasRole } from '../src/auth/access-control';

function profile(role: 'seller' | 'admin', status: 'active' | 'disabled' = 'active'): AuthProfile {
  return { role, status } as unknown as AuthProfile;
}

describe('seller MVP access boundaries', () => {
  it('allows seller access to Seller but not Admin', () => {
    expect(hasRole(profile('seller'), 'seller')).toBe(true);
    expect(hasRole(profile('seller'), 'admin')).toBe(false);
    expect(canAccessArea(profile('seller'), 'seller')).toBe(true);
    expect(canAccessArea(profile('seller'), 'admin')).toBe(false);
  });

  it('allows Admin to enter both areas', () => {
    expect(hasRole(profile('admin'), 'seller')).toBe(true);
    expect(hasRole(profile('admin'), 'admin')).toBe(true);
  });

  it('denies inactive profiles', () => {
    expect(canAccessArea(profile('seller', 'disabled'), 'seller')).toBe(false);
  });

  it('keeps the /admin layout behind the admin role guard', () => {
    const layout = readFileSync(resolve(__dirname, '../src/app/admin/layout.tsx'), 'utf8');
    expect(layout).toContain("requireRole('admin')");
  });
});
