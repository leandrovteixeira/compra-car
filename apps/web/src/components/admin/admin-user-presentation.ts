import type {
  AdminUserDto,
  AdminUserProfileState,
  AppRole,
  UserStatus,
} from '@compra-car/contracts';

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
});

const ROLE_LABELS: Readonly<Record<AppRole, string>> = {
  admin: 'Administrador',
  seller: 'Vendedor',
};

const STATUS_LABELS: Readonly<Record<UserStatus, string>> = {
  active: 'Ativo',
  disabled: 'Inativo',
  pending: 'Pendente',
};

const PROFILE_STATE_LABELS: Readonly<Record<AdminUserProfileState, string>> = {
  invalid: 'Perfil inválido',
  missing: 'Perfil ausente',
  valid: 'Perfil válido',
};

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function adminUserRoleLabel(role: AppRole | null): string {
  return role ? ROLE_LABELS[role] : '—';
}

export function adminUserStatusLabel(status: UserStatus | null): string {
  return status ? STATUS_LABELS[status] : '—';
}

export function adminUserProfileStateLabel(state: AdminUserProfileState): string {
  return PROFILE_STATE_LABELS[state];
}

export function formatAdminUserCreatedAt(value: string): string {
  const date = validDate(value);
  return date ? DATE_FORMATTER.format(date) : '—';
}

export function formatAdminUserLastSignIn(value: string | null): string {
  if (!value) return 'Nunca';
  const date = validDate(value);
  return date ? DATE_TIME_FORMATTER.format(date).replace(',', '') : '—';
}

export function formatAdminUserPasswordRecovery(value: string | null): string {
  if (!value) return '—';
  const date = validDate(value);
  return date ? DATE_TIME_FORMATTER.format(date).replace(',', '') : '—';
}

export function newestAdminUsersFirst(users: readonly AdminUserDto[]): readonly AdminUserDto[] {
  return [...users].sort((left, right) => {
    const leftTime = validDate(left.createdAt)?.getTime() ?? 0;
    const rightTime = validDate(right.createdAt)?.getTime() ?? 0;
    return rightTime - leftTime || left.id.localeCompare(right.id);
  });
}
