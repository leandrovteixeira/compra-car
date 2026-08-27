import 'server-only';

import { APP_ROLES, type AdminUserDto, type AppRole } from '@compra-car/contracts';
import { AdminUserAdapterAuthRateLimitError } from '@compra-car/adapter-supabase';

export type AdminUserActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly message: string };

export interface AdminUserManager {
  countActiveAdmins(): Promise<number>;
  findAdminUserByEmail(email: string): Promise<AdminUserDto | null>;
  getAdminUser(id: string): Promise<AdminUserDto | null>;
  inviteAdminUser(input: {
    readonly email: string;
    readonly fullName: string;
    readonly invitedBy: string;
    readonly redirectTo: string;
    readonly role: AppRole;
  }): Promise<string>;
  requestPasswordRecovery(id: string, email: string, redirectTo: string): Promise<void>;
  setAdminUserRole(id: string, role: AppRole): Promise<void>;
  setAdminUserStatus(id: string, status: 'active' | 'disabled', actorId: string): Promise<void>;
}

export interface AdminUserManagementDependencies {
  readonly authorize: () => Promise<{ readonly user: { readonly id: string } }>;
  readonly createManager: () => AdminUserManager;
  readonly inviteRedirectUrl: () => string;
  readonly recoveryRedirectUrl: () => string;
  readonly revalidate: (path: string) => void;
}

const GENERIC_ERROR = 'Não foi possível concluir a operação. Tente novamente.';
const INVALID_INPUT = 'Revise os dados informados.';

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

function validRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

function failed(message = GENERIC_ERROR): AdminUserActionState {
  return { status: 'error', message };
}

async function authorizedManager(dependencies: AdminUserManagementDependencies) {
  const identity = await dependencies.authorize();
  return { actorId: identity.user.id, manager: dependencies.createManager() };
}

export async function inviteAdminUser(
  formData: FormData,
  dependencies: AdminUserManagementDependencies,
): Promise<AdminUserActionState> {
  const { actorId, manager } = await authorizedManager(dependencies);
  const fullName = text(formData, 'fullName').replace(/\s+/gu, ' ');
  const email = text(formData, 'email').toLowerCase();
  const role = text(formData, 'role');
  if (!fullName || fullName.length > 160 || !validEmail(email) || !validRole(role)) {
    return failed(INVALID_INPUT);
  }

  try {
    if (await manager.findAdminUserByEmail(email)) {
      return failed('Já existe um usuário com este e-mail.');
    }
    await manager.inviteAdminUser({
      email,
      fullName,
      invitedBy: actorId,
      redirectTo: dependencies.inviteRedirectUrl(),
      role,
    });
    dependencies.revalidate('/admin/users');
    return { status: 'success', message: 'Convite enviado.' };
  } catch (error) {
    console.error('Administrative user invitation failed.', { error });
    if (error instanceof AdminUserAdapterAuthRateLimitError) {
      return failed('Aguarde alguns instantes antes de enviar outro convite.');
    }
    return failed(
      error instanceof Error && error.name === 'AdminUserAdapterProfileUpdateError'
        ? 'O convite foi enviado, mas o perfil não pôde ser configurado. Revise a inconsistência na lista.'
        : GENERIC_ERROR,
    );
  }
}

async function loadHealthyTarget(manager: AdminUserManager, id: string) {
  const target = id ? await manager.getAdminUser(id) : null;
  return target?.profileState === 'valid' ? target : null;
}

export async function setAdminUserStatus(
  formData: FormData,
  dependencies: AdminUserManagementDependencies,
): Promise<AdminUserActionState> {
  const { actorId, manager } = await authorizedManager(dependencies);
  const id = text(formData, 'userId');
  const status = text(formData, 'status');
  if (status !== 'active' && status !== 'disabled') return failed(INVALID_INPUT);

  try {
    const target = await loadHealthyTarget(manager, id);
    if (!target) return failed('Usuário não encontrado ou com perfil inconsistente.');
    if (target.status === 'pending')
      return failed('Convites pendentes não podem ser ativados por esta ação.');
    if (id === actorId && status === 'disabled')
      return failed('Você não pode desativar o próprio acesso.');
    if (target.role === 'admin' && target.status === 'active' && status === 'disabled') {
      if ((await manager.countActiveAdmins()) <= 1) {
        return failed('Não é possível remover o último administrador ativo.');
      }
    }
    await manager.setAdminUserStatus(id, status, actorId);
    dependencies.revalidate('/admin/users');
    return {
      status: 'success',
      message: status === 'active' ? 'Acesso ativado.' : 'Acesso desativado.',
    };
  } catch (error) {
    console.error('Administrative user status update failed.', { error });
    return failed();
  }
}

export async function setAdminUserRole(
  formData: FormData,
  dependencies: AdminUserManagementDependencies,
): Promise<AdminUserActionState> {
  const { actorId, manager } = await authorizedManager(dependencies);
  const id = text(formData, 'userId');
  const role = text(formData, 'role');
  if (!validRole(role)) return failed(INVALID_INPUT);

  try {
    const target = await loadHealthyTarget(manager, id);
    if (!target) return failed('Usuário não encontrado ou com perfil inconsistente.');
    if (id === actorId && target.role === 'admin' && role !== 'admin') {
      return failed('Você não pode remover o próprio perfil de administrador.');
    }
    if (target.role === 'admin' && target.status === 'active' && role !== 'admin') {
      if ((await manager.countActiveAdmins()) <= 1) {
        return failed('Não é possível remover o último administrador ativo.');
      }
    }
    await manager.setAdminUserRole(id, role);
    dependencies.revalidate('/admin/users');
    return { status: 'success', message: 'Perfil alterado.' };
  } catch (error) {
    console.error('Administrative user role update failed.', { error });
    return failed();
  }
}

export async function sendAdminUserPasswordRecovery(
  formData: FormData,
  dependencies: AdminUserManagementDependencies,
): Promise<AdminUserActionState> {
  const { manager } = await authorizedManager(dependencies);
  const id = text(formData, 'userId');
  try {
    const target = id ? await manager.getAdminUser(id) : null;
    if (!target?.email) return failed('Usuário não encontrado ou sem e-mail disponível.');
    await manager.requestPasswordRecovery(
      target.id,
      target.email,
      dependencies.recoveryRedirectUrl(),
    );
    dependencies.revalidate('/admin/users');
    return { status: 'success', message: 'E-mail de redefinição solicitado.' };
  } catch (error) {
    console.error('Administrative password recovery failed.', { error });
    if (error instanceof AdminUserAdapterAuthRateLimitError) {
      return failed('Aguarde alguns instantes antes de solicitar um novo e-mail.');
    }
    return failed();
  }
}
