import { loadAdminUsers } from '@/application/admin/load-admin-users';
import { AdminUserAdapterError } from '@compra-car/adapter-supabase';

import { AdminUserError } from '@/components/admin/admin-user-error';
import { AdminUserInvite } from '@/components/admin/admin-user-invite';
import { AdminUserList } from '@/components/admin/admin-user-list';
import { newestAdminUsersFirst } from '@/components/admin/admin-user-presentation';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminInviteRequests } from '@/server/invite-requests';
import { AdminInviteRequestList } from '@/components/admin/admin-invite-request-list';
import { APP_NAME } from '@/config/app-identity';

export default async function AdminUsersPage() {
  let users;

  try {
    users = newestAdminUsersFirst(await loadAdminUsers());
  } catch (error) {
    if (!(error instanceof AdminUserAdapterError)) throw error;
    users = null;
  }

  return (
    <>
      <PageHeader
        actions={<AdminUserInvite />}
        description={`Gerencie os usuários com acesso ao ${APP_NAME}.`}
        title="Usuários"
      />

      <div className="mt-8">
        {users === null ? (
          <AdminUserError />
        ) : users.length === 0 ? (
          <EmptyState
            description="Ainda não há usuários disponíveis para consulta."
            title="Nenhum usuário encontrado"
          />
        ) : (
          <AdminUserList users={users} />
        )}
      </div>
      <div className="mt-10 border-t border-slate-800 pt-8">
        <AdminInviteRequestList requests={await loadAdminInviteRequests()} />
      </div>
    </>
  );
}
