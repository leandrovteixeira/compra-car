import { describe, expect, it } from 'vitest';
import { getSidebarNavigation } from './sidebar-navigation';
import type { AccountTier } from '@/auth/entitlements-23c';

const links = (tier: AccountTier) =>
  getSidebarNavigation(tier).flatMap((item) =>
    item.children
      ? item.children.map((child) => child.href).filter(Boolean)
      : [item.href].filter(Boolean),
  );

describe('shared desktop and mobile navigation by account tier', () => {
  it.each(['visitor', 'public'] as const)('%s only sees current public vehicle pages', (tier) => {
    expect(links(tier)).toEqual([
      '/',
      '/fichas-tecnicas',
      '/comparar-modelos',
      '/comparar-especificacoes',
    ]);
  });

  it('adds only the price list for Corporate', () => {
    expect(links('corporate')).toEqual([...links('public'), '/admin/prices/list']);
  });

  it('keeps current commercial policies visible to Admin and Master only', () => {
    for (const tier of ['admin', 'master'] as const) {
      const priceGroup = getSidebarNavigation(tier).find((item) => item.label === 'Preços');
      const policies = priceGroup?.children?.find((child) => child.href === '/admin/prices/policies/current');
      expect(policies?.status).toBe('active');
    }
    expect(links('corporate')).not.toContain('/admin/prices/policies/current');
    expect(links('public')).not.toContain('/admin/prices/policies/current');
  });

  it('keeps both Agents destinations exclusive to Master', () => {
    expect(links('admin')).toContain('/admin/products');
    expect(links('admin')).not.toContain('/admin/users');
    expect(links('admin')).not.toContain('/admin/agents');
    expect(links('admin')).not.toContain('/admin/agents/flight-control');
    expect(links('master')).toEqual(
      expect.arrayContaining([
        '/admin/users',
        '/admin/agents',
        '/admin/agents/flight-control',
        '/admin/products',
      ]),
    );
    const agents = getSidebarNavigation('master').find((item) => item.label === 'Agentes');
    expect(agents?.children?.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Revisões', href: '/admin/agents' },
      { label: 'Flight Control', href: '/admin/agents/flight-control' },
    ]);
  });
});
