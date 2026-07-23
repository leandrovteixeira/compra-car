import type { AuthProfile } from '@compra-car/adapter-supabase';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getAuthenticatedNavigationModel } from '../src/components/authenticated-navigation-policy';

const sellerProfile: AuthProfile = {
  id: 'seller-id',
  role: 'seller',
  status: 'active',
  fullName: 'Vendedor Teste',
};

const adminProfile: AuthProfile = {
  id: 'admin-id',
  role: 'admin',
  status: 'active',
  fullName: 'Administrador Teste',
};

describe('authenticated navigation', () => {
  it('shows the seller area without an admin link for an active seller', () => {
    const navigation = getAuthenticatedNavigationModel(sellerProfile, 'seller');

    expect(navigation.areaLabel).toBe('Área do vendedor');
    expect(navigation.roleLabel).toBe('Vendedor');
    expect(navigation.links).toEqual([]);
  });

  it('shows the admin link in the seller area for an active admin', () => {
    const navigation = getAuthenticatedNavigationModel(adminProfile, 'seller');

    expect(navigation.links).toEqual([{ href: '/admin', label: 'Administração' }]);
    expect(navigation.roleLabel).toBe('Administrador');
  });

  it('keeps seller access available in the admin area', () => {
    const navigation = getAuthenticatedNavigationModel(adminProfile, 'admin');

    expect(navigation.areaLabel).toBe('Área administrativa');
    expect(navigation.links).toEqual([{ href: '/', label: 'Área do vendedor' }]);
  });

  it('ignores user metadata when deciding whether to show the admin link', () => {
    const profileWithUntrustedMetadata = {
      ...sellerProfile,
      user_metadata: { role: 'admin' },
    };

    expect(getAuthenticatedNavigationModel(profileWithUntrustedMetadata, 'seller').links).toEqual(
      [],
    );
  });

  it('uses the shared component in both layouts and binds the existing logout action', () => {
    const componentSource = readFileSync(
      resolve(__dirname, '../src/components/authenticated-navigation.tsx'),
      'utf8',
    );
    const sellerLayoutSource = readFileSync(
      resolve(__dirname, '../src/app/(seller)/layout.tsx'),
      'utf8',
    );
    const adminLayoutSource = readFileSync(
      resolve(__dirname, '../src/app/admin/layout.tsx'),
      'utf8',
    );
    const logoutControlSource = readFileSync(
      resolve(__dirname, '../src/components/logout-control.tsx'),
      'utf8',
    );

    expect(componentSource).toContain("import { logout } from '../app/actions/auth'");
    expect(componentSource).toContain('logoutAction={logout}');
    expect(logoutControlSource).toContain("import { logout } from '../app/actions/auth'");
    expect(logoutControlSource).toContain('action={logout}');
    expect(logoutControlSource).toContain('Sair');
    expect(sellerLayoutSource).toContain('<AppAuthenticatedNavigation area="seller"');
    expect(adminLayoutSource).toContain('<AdminShell displayName={displayName}>');
  });
});
