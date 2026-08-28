import type { AdminUserDto, UserStatus } from '@compra-car/contracts';

import { APP_NAME } from '@/config/app-identity';
import { AdminUserActions } from './admin-user-actions';
import {
  adminUserProfileStateLabel,
  adminUserRoleLabel,
  adminUserStatusLabel,
  formatAdminUserCreatedAt,
  formatAdminUserLastSignIn,
  formatAdminUserPasswordRecovery,
} from './admin-user-presentation';

interface AdminUserListProps {
  readonly users: readonly AdminUserDto[];
}

function badgeClass(status: UserStatus | null): string {
  if (status === 'active') return 'border-emerald-800 bg-emerald-950/50 text-emerald-300';
  if (status === 'pending') return 'border-amber-800 bg-amber-950/50 text-amber-300';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

function ProfileBadges({ user }: { readonly user: AdminUserDto }) {
  if (user.profileState !== 'valid') {
    return (
      <span className="ui-badge border-amber-800 bg-amber-950/50 text-amber-300">
        {adminUserProfileStateLabel(user.profileState)}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <span className="ui-badge ui-badge--info">{adminUserRoleLabel(user.role)}</span>
      <span className={`ui-badge ${badgeClass(user.status)}`}>
        {adminUserStatusLabel(user.status)}
      </span>
    </div>
  );
}

export function AdminUserList({ users }: AdminUserListProps) {
  return (
    <section aria-labelledby="admin-user-list-title">
      <h2 className="sr-only" id="admin-user-list-title">
        Usuários com acesso ao {APP_NAME}
      </h2>

      <div className="grid gap-3 md:hidden">
        {users.map((user) => (
          <article className="min-w-0 rounded-lg border border-border bg-surface p-4" key={user.id}>
            <h3
              className="truncate font-semibold text-text-primary"
              title={user.fullName ?? undefined}
            >
              {user.fullName || '—'}
            </h3>
            <p className="mt-1 break-all text-sm text-text-secondary">{user.email || '—'}</p>
            <div className="mt-4">
              <ProfileBadges user={user} />
            </div>
            <div className="mt-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Senha</p>
              {user.passwordRecoveryRequestedAt ? (
                <div className="mt-1 text-amber-300">
                  <p className="font-semibold">Redefinição solicitada</p>
                  <p className="text-xs text-slate-400">
                    {formatAdminUserPasswordRecovery(user.passwordRecoveryRequestedAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-slate-300">—</p>
              )}
            </div>
            <div className="mt-4">
              <AdminUserActions user={user} />
            </div>
            <dl className="mt-4 grid gap-3 border-t border-slate-800 pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Criado
                </dt>
                <dd className="mt-1 text-slate-300">{formatAdminUserCreatedAt(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Último acesso
                </dt>
                <dd className="mt-1 text-slate-300">
                  {formatAdminUserLastSignIn(user.lastSignInAt)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="ui-table-frame hidden overflow-x-clip overflow-y-visible md:block">
        <table className="ui-table">
          <caption className="sr-only">Usuários cadastrados no Supabase Auth</caption>
          <thead>
            <tr>
              {[
                'Nome',
                'E-mail',
                'Perfil e status',
                'Senha',
                'Criado em',
                'Último acesso',
                'Ações',
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="align-middle transition hover:bg-surface-muted" key={user.id}>
                <td className="max-w-48 font-semibold text-text-primary">
                  <span className="block truncate" title={user.fullName ?? undefined}>
                    {user.fullName || '—'}
                  </span>
                </td>
                <td className="max-w-64 text-text-secondary">
                  <span className="block break-all">{user.email || '—'}</span>
                </td>
                <td>
                  <ProfileBadges user={user} />
                </td>
                <td className="whitespace-nowrap">
                  {user.passwordRecoveryRequestedAt ? (
                    <div className="text-amber-300">
                      <p className="font-semibold">Redefinição solicitada</p>
                      <p className="text-xs text-slate-400">
                        {formatAdminUserPasswordRecovery(user.passwordRecoveryRequestedAt)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-slate-300">
                  {formatAdminUserCreatedAt(user.createdAt)}
                </td>
                <td className="whitespace-nowrap text-slate-300">
                  {formatAdminUserLastSignIn(user.lastSignInAt)}
                </td>
                <td>
                  <AdminUserActions user={user} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
          {users.length} {users.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}
        </p>
      </div>
    </section>
  );
}
