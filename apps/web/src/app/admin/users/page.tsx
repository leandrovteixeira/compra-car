import Link from 'next/link';

import { requireFeature23C } from '@/auth/account-tier-server';
import { loadAdminUsers } from '@/application/admin/load-admin-users';
import { AdminUserAdapterError } from '@compra-car/adapter-supabase';
import { AdminUserInvite } from '@/components/admin/admin-user-invite';
import { AdminUserError } from '@/components/admin/admin-user-error';
import { AdminUserList } from '@/components/admin/admin-user-list';
import { newestAdminUsersFirst } from '@/components/admin/admin-user-presentation';
import { AdminInviteRequestList } from '@/components/admin/admin-invite-request-list';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminInviteRequests } from '@/server/invite-requests';
import { APP_NAME } from '@/config/app-identity';

type Tab = 'users' | 'requests' | 'organizations';
const tabs: readonly { key: Tab; label: string }[] = [
  { key: 'users', label: 'Usuários' },
  { key: 'requests', label: 'Solicitações' },
  { key: 'organizations', label: 'Organizações' },
];

export default async function AdminUsersPage({ searchParams }: {
  readonly searchParams: Promise<{ tab?: string }>;
}) {
  await requireFeature23C('settings');
  const params = await searchParams;
  const tab: Tab = params.tab === 'requests' || params.tab === 'organizations'
    ? params.tab
    : 'users';

  let users = null;
  if (tab === 'users') {
    try {
      users = newestAdminUsersFirst(await loadAdminUsers());
    } catch (error) {
      if (!(error instanceof AdminUserAdapterError)) throw error;
    }
  }

  return (
    <>
      <PageHeader
        actions={tab === 'users' ? <AdminUserInvite /> : undefined}
        description={`Gerencie os acessos ao ${APP_NAME}.`}
        title="Gestão de Usuários"
      />
      <nav aria-label="Seções da gestão de usuários" className="mt-6 flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/admin/users?tab=${item.key}`}
            aria-current={tab === item.key ? 'page' : undefined}
            className={`border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors ${
              tab === item.key
                ? 'border-[#EF7732] text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-7">
        {tab === 'users' ? (
          users === null ? <AdminUserError /> :
          users.length === 0 ? <EmptyState title="Nenhum usuário encontrado" description="Ainda não há usuários cadastrados." /> :
          <AdminUserList users={users} />
        ) : null}
        {tab === 'requests' ? (
          <section className="space-y-7">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Solicitações Corporate</h2>
              <p className="mt-2 text-sm text-text-secondary">
                A fila de Upgrade foi criada no Staging. A visualização de todos os pedidos
                e as decisões administrativas precisam de um serviço Master auditável;
                nenhuma solicitação será aprovada automaticamente.
              </p>
            </div>
            <AdminInviteRequestList requests={await loadAdminInviteRequests()} />
          </section>
        ) : null}
        {tab === 'organizations' ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Organizações Corporate</h2>
            <p className="mt-2 text-sm text-text-secondary">
              A organização interna Compra Car — Early Access já existe no Staging.
              Vinculação de profissionais, concessão de licenças e gestão de organizações
              serão habilitadas após concluirmos os controles Master.
            </p>
          </section>
        ) : null}
      </div>
    </>
  );
}
