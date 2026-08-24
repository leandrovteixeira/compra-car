import type { AdminUserDto, UserStatus } from '@compra-car/contracts';

import { AdminUserActions } from './admin-user-actions';
import {
  adminUserProfileStateLabel,
  adminUserRoleLabel,
  adminUserStatusLabel,
  formatAdminUserCreatedAt,
  formatAdminUserLastSignIn,
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
      <span className="inline-flex rounded-full border border-amber-800 bg-amber-950/50 px-2.5 py-1 text-xs font-semibold text-amber-300">
        {adminUserProfileStateLabel(user.profileState)}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex rounded-full border border-sky-800 bg-sky-950/50 px-2.5 py-1 text-xs font-semibold text-sky-300">
        {adminUserRoleLabel(user.role)}
      </span>
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(user.status)}`}
      >
        {adminUserStatusLabel(user.status)}
      </span>
    </div>
  );
}

export function AdminUserList({ users }: AdminUserListProps) {
  return (
    <section aria-labelledby="admin-user-list-title">
      <h2 className="sr-only" id="admin-user-list-title">
        Usuários com acesso ao Compra Car
      </h2>

      <div className="grid gap-4 md:hidden">
        {users.map((user) => (
          <article
            className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            key={user.id}
          >
            <h3
              className="truncate font-semibold text-slate-100"
              title={user.fullName ?? undefined}
            >
              {user.fullName || '—'}
            </h3>
            <p className="mt-1 break-all text-sm text-slate-400">{user.email || '—'}</p>
            <div className="mt-4">
              <ProfileBadges user={user} />
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

      <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Usuários cadastrados no Supabase Auth</caption>
          <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {['Nome', 'E-mail', 'Perfil e status', 'Criado em', 'Último acesso', 'Ações'].map(
                (label) => (
                  <th className="px-4 py-3 font-semibold" key={label} scope="col">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((user) => (
              <tr className="align-top transition hover:bg-slate-900/80" key={user.id}>
                <td className="max-w-48 px-4 py-4 font-semibold text-slate-100">
                  <span className="block truncate" title={user.fullName ?? undefined}>
                    {user.fullName || '—'}
                  </span>
                </td>
                <td className="max-w-64 px-4 py-4 text-slate-300">
                  <span className="block break-all">{user.email || '—'}</span>
                </td>
                <td className="px-4 py-4">
                  <ProfileBadges user={user} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                  {formatAdminUserCreatedAt(user.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                  {formatAdminUserLastSignIn(user.lastSignInAt)}
                </td>
                <td className="px-4 py-4">
                  <AdminUserActions user={user} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
          {users.length} {users.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}
        </p>
      </div>
    </section>
  );
}
