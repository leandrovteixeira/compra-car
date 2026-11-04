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

  it('keeps Corporate consultation-only', () => {
    const corporate = links('corporate');
    expect(corporate).toContain('/admin/prices/list');
    expect(corporate).not.toContain('/admin/products');
    expect(corporate).not.toContain('/admin/prices');
    expect(corporate).not.toContain('/admin/agents');
    expect(corporate).not.toContain('/admin/users');
  });

  it('gives internal Admin operational tools but not global Settings', () => {
    const admin = links('admin');
    expect(admin).toEqual(expect.arrayContaining([
      '/admin/products',
      '/admin/prices',
      '/admin/prices/input',
      '/admin/prices/policies/input',
      '/admin/prices/policies/current',
      '/admin/news',
      '/admin/agents',
    ]));
    expect(admin).not.toContain('/admin/users');
    expect(admin).not.toContain('/admin/imports');
  });

  it('keeps global configuration exclusive to Master', () => {
    const master = links('master');
    expect(master).toEqual(expect.arrayContaining([
      '/admin/users',
      '/admin/imports',
      '/admin/agents',
      '/admin/products',
    ]));
  });

  it('keeps the existing Agents destination active for Admin and Master', () => {
    for (const tier of ['admin', 'master'] as const) {
      const agents = getSidebarNavigation(tier).find((item) => item.label === 'Agentes');
      expect(agents?.children?.map(({ label, href }) => ({ label, href }))).toEqual([
        { label: 'Agentes', href: '/admin/agents' },
      ]);
    }
  });
});
