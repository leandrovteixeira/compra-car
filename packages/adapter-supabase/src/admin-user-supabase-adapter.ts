import {
  APP_ROLES,
  USER_STATUSES,
  type AdminUserDto,
  type AppRole,
  type UserStatus,
} from '@compra-car/contracts';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import {
  AdminUserAdapterAuthRateLimitError,
  AdminUserAdapterConfigurationError,
  AdminUserAdapterMappingError,
  AdminUserAdapterInviteError,
  AdminUserAdapterProfileUpdateError,
  AdminUserAdapterQueryError,
  AdminUserAdapterRecoveryError,
} from './errors';

const AUTH_USERS_PER_PAGE = 200;
const AUTH_RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);

function authErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export interface AdminUserSupabaseClientConfig {
  readonly url: string;
  readonly serverKey: string;
}

interface AdminProfileRow {
  readonly id: unknown;
  readonly full_name: unknown;
  readonly role: unknown;
  readonly status: unknown;
  readonly password_recovery_requested_at?: unknown;
}

function requiredServerConfig(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new AdminUserAdapterConfigurationError(
      `Variável de ambiente obrigatória ausente: ${name}.`,
    );
  }
  return value.trim();
}

function assertServerRuntime(): void {
  if (typeof window !== 'undefined') {
    throw new AdminUserAdapterConfigurationError(
      'O cliente administrativo de usuários só pode ser criado no servidor.',
    );
  }
}

export function createAdminUserSupabaseClient(
  config: AdminUserSupabaseClientConfig,
): SupabaseClient {
  assertServerRuntime();
  return createClient(
    requiredServerConfig(config.url, 'SUPABASE_URL'),
    requiredServerConfig(config.serverKey, 'SUPABASE_SERVER_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function mapProfileRows(rows: readonly AdminProfileRow[]): ReadonlyMap<string, AdminProfileRow> {
  const profiles = new Map<string, AdminProfileRow>();
  for (const row of rows) {
    if (typeof row.id !== 'string' || !row.id) {
      throw new AdminUserAdapterMappingError('Profile administrativo retornou id inválido.');
    }
    profiles.set(row.id, row);
  }
  return profiles;
}

export function mapAdminUser(user: User, profile: AdminProfileRow | undefined): AdminUserDto {
  if (!user.id || !user.created_at) {
    throw new AdminUserAdapterMappingError(
      'Auth user administrativo retornou campos obrigatórios inválidos.',
    );
  }

  const fullName = typeof profile?.full_name === 'string' ? profile.full_name : null;
  const hasValidRole = APP_ROLES.includes(profile?.role as AppRole);
  const hasValidStatus = USER_STATUSES.includes(profile?.status as UserStatus);
  const hasValidProfile = profile !== undefined && hasValidRole && hasValidStatus;
  const profileState = profile === undefined ? 'missing' : hasValidProfile ? 'valid' : 'invalid';

  return Object.freeze({
    id: user.id,
    email: typeof user.email === 'string' ? user.email : null,
    fullName,
    role: hasValidProfile ? (profile.role as AppRole) : null,
    status: hasValidProfile ? (profile.status as UserStatus) : null,
    profileState,
    passwordRecoveryRequestedAt:
      typeof profile?.password_recovery_requested_at === 'string'
        ? profile.password_recovery_requested_at
        : null,
    createdAt: user.created_at,
    lastSignInAt: typeof user.last_sign_in_at === 'string' ? user.last_sign_in_at : null,
  });
}

export class AdminUserSupabaseAdapter {
  constructor(private readonly client: SupabaseClient) {}

  async listAdminUsers(): Promise<readonly AdminUserDto[]> {
    const result: AdminUserDto[] = [];
    let page = 1;

    while (true) {
      const { data: authData, error: authError } = await this.client.auth.admin.listUsers({
        page,
        perPage: AUTH_USERS_PER_PAGE,
      });
      if (authError) {
        throw new AdminUserAdapterQueryError('Não foi possível listar usuários do Supabase Auth.', {
          cause: authError,
        });
      }

      const users = authData.users;
      if (users.length === 0) break;

      const { data: profileData, error: profileError } = await this.client
        .from('profiles')
        .select('id,full_name,role,status,password_recovery_requested_at')
        .in(
          'id',
          users.map((user) => user.id),
        );
      if (profileError) {
        throw new AdminUserAdapterQueryError('Não foi possível listar profiles administrativos.', {
          cause: profileError,
        });
      }

      const profiles = mapProfileRows((profileData ?? []) as AdminProfileRow[]);
      result.push(...users.map((user) => mapAdminUser(user, profiles.get(user.id))));

      if (authData.nextPage === null) break;
      page = authData.nextPage;
    }

    return Object.freeze(result);
  }

  async findAdminUserByEmail(email: string): Promise<AdminUserDto | null> {
    const normalized = email.trim().toLowerCase();
    return (
      (await this.listAdminUsers()).find((user) => user.email?.toLowerCase() === normalized) ?? null
    );
  }

  async getAdminUser(id: string): Promise<AdminUserDto | null> {
    const { data: authData, error: authError } = await this.client.auth.admin.getUserById(id);
    if (authError || !authData.user) return null;
    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('id,full_name,role,status,password_recovery_requested_at')
      .eq('id', id)
      .maybeSingle();
    if (profileError) {
      throw new AdminUserAdapterQueryError('Unable to load administrative user profile.', {
        cause: profileError,
      });
    }
    return mapAdminUser(authData.user, profile as AdminProfileRow | undefined);
  }

  async inviteAdminUser(input: {
    readonly email: string;
    readonly fullName: string;
    readonly role: AppRole;
    readonly invitedBy: string;
    readonly redirectTo: string;
  }): Promise<string> {
    const { data, error } = await this.client.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.fullName },
      redirectTo: input.redirectTo,
    });
    if (error || !data.user) {
      if (AUTH_RATE_LIMIT_CODES.has(authErrorCode(error) ?? '')) {
        throw new AdminUserAdapterAuthRateLimitError('Auth e-mail rate limit reached.', {
          cause: error,
        });
      }
      throw new AdminUserAdapterInviteError('Auth invitation failed.', { cause: error });
    }

    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .update({
        full_name: input.fullName,
        invited_at: new Date().toISOString(),
        invited_by: input.invitedBy,
        role: input.role,
        status: 'pending',
      })
      .eq('id', data.user.id)
      .select('id')
      .single();
    if (profileError || !profile) {
      throw new AdminUserAdapterProfileUpdateError('Invited Auth user profile update failed.', {
        cause: profileError,
      });
    }
    return data.user.id;
  }

  async countActiveAdmins(): Promise<number> {
    const { count, error } = await this.client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'active');
    if (error || count === null) {
      throw new AdminUserAdapterQueryError('Unable to count active administrators.', {
        cause: error,
      });
    }
    return count;
  }

  async setAdminUserRole(id: string, role: AppRole): Promise<void> {
    await this.updateProfile(id, { role });
  }

  async setAdminUserStatus(
    id: string,
    status: 'active' | 'disabled',
    actorId: string,
  ): Promise<void> {
    await this.updateProfile(
      id,
      status === 'disabled'
        ? { disabled_at: new Date().toISOString(), disabled_by: actorId, status }
        : { disabled_at: null, disabled_by: null, status },
    );
  }

  async requestPasswordRecovery(id: string, email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      if (AUTH_RATE_LIMIT_CODES.has(authErrorCode(error) ?? '')) {
        throw new AdminUserAdapterAuthRateLimitError('Auth e-mail rate limit reached.', {
          cause: error,
        });
      }
      throw new AdminUserAdapterRecoveryError('Password recovery request failed.', {
        cause: error,
      });
    }
    await this.updateProfile(id, { password_recovery_requested_at: new Date().toISOString() });
  }

  async clearPasswordRecoveryRequested(id: string): Promise<void> {
    await this.updateProfile(id, { password_recovery_requested_at: null });
  }

  async activatePendingUser(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) {
      throw new AdminUserAdapterProfileUpdateError('Pending profile activation failed.', {
        cause: error,
      });
    }
    return Boolean(data);
  }

  private async updateProfile(id: string, values: Record<string, unknown>): Promise<void> {
    const { data, error } = await this.client
      .from('profiles')
      .update(values)
      .eq('id', id)
      .select('id')
      .single();
    if (error || !data) {
      throw new AdminUserAdapterProfileUpdateError('Administrative profile update failed.', {
        cause: error,
      });
    }
  }
}
