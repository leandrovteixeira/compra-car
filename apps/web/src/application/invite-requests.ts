import 'server-only';
import type { InviteRequestDto } from '@compra-car/contracts';
import type {
  AdminUserManager,
  AdminUserActionState,
  AdminUserManagementDependencies,
} from './admin/admin-user-management';
import { inviteAdminUser } from './admin/admin-user-management';

export interface InviteRequestRepository {
  create(by: string, name: string, email: string): Promise<InviteRequestDto>;
  listMine(by: string): Promise<readonly InviteRequestDto[]>;
  listPending(): Promise<readonly InviteRequestDto[]>;
  get(id: string): Promise<InviteRequestDto | null>;
  review(id: string, status: 'approved' | 'rejected', by: string): Promise<boolean>;
}
export interface InviteRequestDependencies {
  authorizeActive: () => Promise<{ user: { id: string } }>;
  authorizeAdmin: () => Promise<{ user: { id: string } }>;
  repository: (privileged: boolean) => InviteRequestRepository;
  users: () => AdminUserManager;
  adminInviteDependencies: AdminUserManagementDependencies;
  revalidate(path: string): void;
}
const normalize = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : '';
export async function createInviteRequest(
  data: FormData,
  d: InviteRequestDependencies,
): Promise<AdminUserActionState> {
  const { user } = await d.authorizeActive();
  const name = normalize(data.get('name')).replace(/\s+/gu, ' ');
  const email = normalize(data.get('email')).toLowerCase();
  if (!name || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    return { status: 'error', message: 'Revise os dados informados.' };
  try {
    if (await d.users().findAdminUserByEmail(email))
      return { status: 'error', message: 'Já existe um usuário com este e-mail.' };
    await d.repository(false).create(user.id, name, email);
    d.revalidate('/invite-requests');
    return {
      status: 'success',
      message: 'Pedido enviado. Um administrador analisará a solicitação.',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error && error.message === 'INVITE_REQUEST_DUPLICATE'
          ? 'Já existe um pedido pendente para este e-mail.'
          : 'Não foi possível enviar o pedido.',
    };
  }
}
export async function approveInviteRequest(
  data: FormData,
  d: InviteRequestDependencies,
): Promise<AdminUserActionState> {
  const { user } = await d.authorizeAdmin();
  const id = normalize(data.get('requestId'));
  const repo = d.repository(true);
  const request = await repo.get(id);
  if (!request || request.status !== 'pending')
    return { status: 'error', message: 'Este pedido já foi analisado.' };
  if (await d.users().findAdminUserByEmail(request.inviteeEmail))
    return { status: 'error', message: 'Já existe um usuário com este e-mail.' };
  const inviteData = new FormData();
  inviteData.set('fullName', request.inviteeName);
  inviteData.set('email', request.inviteeEmail);
  inviteData.set('role', 'seller');
  const invited = await inviteAdminUser(inviteData, d.adminInviteDependencies);
  if (invited.status !== 'success') return invited;
  if (!(await repo.review(id, 'approved', user.id)))
    return {
      status: 'error',
      message: 'O convite foi enviado, mas o pedido não pôde ser marcado como aprovado.',
    };
  d.revalidate('/admin/users');
  return { status: 'success', message: 'Pedido aprovado e convite enviado.' };
}
export async function rejectInviteRequest(
  data: FormData,
  d: InviteRequestDependencies,
): Promise<AdminUserActionState> {
  const { user } = await d.authorizeAdmin();
  const ok = await d.repository(true).review(normalize(data.get('requestId')), 'rejected', user.id);
  if (!ok) return { status: 'error', message: 'Este pedido já foi analisado.' };
  d.revalidate('/admin/users');
  return { status: 'success', message: 'Pedido recusado.' };
}
