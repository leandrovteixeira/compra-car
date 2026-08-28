import type { AuthProfile } from '@compra-car/adapter-supabase';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  getAuthenticatedNavigationModel,
  getAvailableContexts,
} from '../src/components/authenticated-navigation-policy';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

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
    expect(navigation.localLinks).toEqual([{ href: '/invite-requests', label: 'Convidar alguém' }]);
  });

  it('shows the admin link in the seller area for an active admin', () => {
    const navigation = getAuthenticatedNavigationModel(adminProfile, 'seller');

    expect(navigation.localLinks).toEqual([{ href: '/invite-requests', label: 'Convidar alguém' }]);
    expect(navigation.roleLabel).toBe('Administrador');
  });

  it('keeps seller access available in the admin area', () => {
    const navigation = getAuthenticatedNavigationModel(adminProfile, 'admin');

    expect(navigation.areaLabel).toBe('Área administrativa');
    expect(navigation.localLinks).toEqual([]);
  });

  it('ignores user metadata when deciding whether to show the admin link', () => {
    const profileWithUntrustedMetadata = {
      ...sellerProfile,
      user_metadata: { role: 'admin' },
    };

    expect(
      getAuthenticatedNavigationModel(profileWithUntrustedMetadata, 'seller').localLinks,
    ).toEqual([{ href: '/invite-requests', label: 'Convidar alguém' }]);
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
    expect(adminLayoutSource).toContain('profile={profile}');
  });

  it('keeps context authorization in the trusted profile and exposes shared shell controls', () => {
    const switcher = source('../src/components/context-switcher.tsx');
    const topbar = source('../src/components/application-topbar.tsx');
    const userMenu = source('../src/components/user-menu.tsx');

    expect(getAvailableContexts(sellerProfile)).toEqual([
      { area: 'seller', href: '/', label: 'Vendedor' },
    ]);
    expect(getAvailableContexts(adminProfile)).toEqual([
      { area: 'admin', href: '/admin', label: 'Administração' },
      { area: 'seller', href: '/', label: 'Vendedor' },
    ]);
    expect(switcher).toContain('getAvailableContexts(profile)');
    expect(switcher).toContain("aria-current={context.area === area ? 'page' : undefined}");
    expect(topbar).toContain('<BrandSlot');
    expect(topbar).toContain('<ContextSwitcher');
    expect(topbar).toContain('<UserMenu');
    expect(userMenu).toContain('Menu do usuário');
    expect(userMenu).toContain('<LogoutControl');
  });

  it('uses an explicit narrow-width grid without positioning Mais over the context switcher', () => {
    const topbar = source('../src/components/application-topbar.tsx');
    const navigation = source('../src/components/authenticated-navigation.tsx');
    const brand = source('../src/components/brand-slot.tsx');
    const switcher = source('../src/components/context-switcher.tsx');

    expect(topbar).toContain('grid-cols-[auto_minmax(0,1fr)_auto_auto]');
    expect(topbar).toContain('min-[23rem]:gap-1.5');
    expect(topbar).toContain('shrink-0 justify-self-end');
    expect(brand).toContain('className="sm:hidden"');
    expect(switcher).toContain('shrink-0');
    expect(switcher).toContain('min-[23rem]:px-2');
    expect(navigation).toContain('aria-label="Mais"');
    expect(navigation).toContain('min-[28rem]:hidden');
    expect(navigation).toContain('relative shrink-0 sm:hidden');
    expect(navigation).not.toMatch(/<summary[^>]*absolute/s);
  });
});
