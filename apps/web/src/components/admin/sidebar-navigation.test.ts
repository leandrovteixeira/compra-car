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

  it('keeps user management and agents exclusive to Master', () => {
    expect(links('admin')).toContain('/admin/products');
    expect(links('admin')).not.toContain('/admin/users');
    expect(links('admin')).not.toContain('/admin/agents');
    expect(links('master')).toEqual(
      expect.arrayContaining(['/admin/users', '/admin/agents', '/admin/products']),
    );
  });
});
