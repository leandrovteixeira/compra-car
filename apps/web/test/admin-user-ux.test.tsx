import type { AdminUserDto } from '@compra-car/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  adminUserRoleLabel,
  adminUserStatusLabel,
  formatAdminUserCreatedAt,
  formatAdminUserLastSignIn,
  newestAdminUsersFirst,
} from '../src/components/admin/admin-user-presentation';

function source(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

function user(overrides: Partial<AdminUserDto> = {}): AdminUserDto {
  return {
    createdAt: '2026-08-24T17:32:00.000Z',
    email: 'admin@example.com',
    fullName: 'Admin Compra Car',
    id: 'user-1',
    lastSignInAt: '2026-08-24T17:32:00.000Z',
    profileState: 'valid',
    role: 'admin',
    status: 'active',
    ...overrides,
  };
}

describe('admin user UX', () => {
  it('renders identity, translated authorization data and Brazilian dates', () => {
    const list = source('../src/components/admin/admin-user-list.tsx');

    expect(list).toContain("{user.fullName || '—'}");
    expect(list).toContain("{user.email || '—'}");
    expect(adminUserRoleLabel('admin')).toBe('Administrador');
    expect(adminUserStatusLabel('active')).toBe('Ativo');
    expect(formatAdminUserCreatedAt(user().createdAt)).toBe('24/08/2026');
    expect(formatAdminUserLastSignIn(user().lastSignInAt)).toBe('24/08/2026 14:32');
  });

  it('handles a missing name and a user who never signed in', () => {
    expect(user({ fullName: null }).fullName).toBeNull();
    expect(formatAdminUserLastSignIn(null)).toBe('Nunca');
  });

  it.each([
    ['missing', 'Perfil ausente'],
    ['invalid', 'Perfil inválido'],
  ] as const)('shows a %s profile without permissive labels', (profileState, warning) => {
    const list = source('../src/components/admin/admin-user-list.tsx');

    expect(list).toContain("if (user.profileState !== 'valid')");
    expect(list.indexOf('adminUserProfileStateLabel(user.profileState)')).toBeLessThan(
      list.indexOf('adminUserRoleLabel(user.role)'),
    );
    expect(warning).toBe(profileState === 'missing' ? 'Perfil ausente' : 'Perfil inválido');
  });

  it('covers every current role/status and date fallback', () => {
    expect(adminUserRoleLabel('seller')).toBe('Vendedor');
    expect(adminUserStatusLabel('pending')).toBe('Pendente');
    expect(adminUserStatusLabel('disabled')).toBe('Inativo');
    expect(formatAdminUserCreatedAt('invalid')).toBe('—');
    expect(formatAdminUserLastSignIn('invalid')).toBe('—');
  });

  it('orders users deterministically by newest creation first', () => {
    const ordered = newestAdminUsersFirst([
      user({ createdAt: '2025-01-01T00:00:00.000Z', id: 'older' }),
      user({ createdAt: '2026-01-01T00:00:00.000Z', id: 'newer' }),
    ]);

    expect(ordered.map(({ id }) => id)).toEqual(['newer', 'older']);
  });

  it('keeps desktop action menus unclipped and centers row content vertically', () => {
    const list = source('../src/components/admin/admin-user-list.tsx');

    expect(list).toContain('hidden overflow-x-clip overflow-y-visible rounded-2xl');
    expect(list).not.toContain('hidden overflow-hidden rounded-2xl');
    expect(list).toContain('className="align-middle transition hover:bg-slate-900/80"');
    expect(list).not.toContain('className="align-top transition hover:bg-slate-900/80"');
    expect(list).toContain('[&_th:first-child]:rounded-tl-2xl');
    expect(list).toContain('[&_th:last-child]:rounded-tr-2xl');
  });

  it('exposes invitation and state-aware actions without browser-side privileged access', () => {
    const invite = source('../src/components/admin/admin-user-invite.tsx');
    const actions = source('../src/components/admin/admin-user-actions.tsx');
    const serverActions = source('../src/app/admin/users/actions.ts');

    expect(invite).toContain('Enviar convite');
    expect(invite).toContain('useActionState');
    expect(actions).toContain("user.status === 'active'");
    expect(actions).toContain("user.status === 'disabled'");
    expect(actions).toContain("user.profileState === 'valid'");
    expect(actions).toContain('Redefinir senha');
    expect(actions).toContain('<dialog');
    expect(serverActions).toContain("'use server'");
    for (const content of [invite, actions]) {
      expect(content).not.toContain('SUPABASE_SERVER_KEY');
      expect(content).not.toContain('auth.admin');
      expect(content).not.toContain('createClient');
    }
  });
});
