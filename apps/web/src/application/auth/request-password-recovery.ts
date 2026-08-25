import 'server-only';

import type { AdminUserDto } from '@compra-car/contracts';

export const PASSWORD_RECOVERY_NEUTRAL_MESSAGE =
  'Se existir uma conta para este e-mail, enviaremos as instruções para redefinir sua senha.';

export type PasswordRecoveryRequestState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly message: string };

export interface PasswordRecoveryRequester {
  findAdminUserByEmail(email: string): Promise<AdminUserDto | null>;
  requestPasswordRecovery(id: string, email: string, redirectTo: string): Promise<void>;
}

export interface PasswordRecoveryRequestDependencies {
  readonly createRequester: () => PasswordRecoveryRequester;
  readonly recoveryRedirectUrl: () => string;
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

export async function requestPasswordRecovery(
  data: FormData,
  dependencies: PasswordRecoveryRequestDependencies,
): Promise<PasswordRecoveryRequestState> {
  const value = data.get('email');
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!validEmail(email)) {
    return { status: 'error', message: 'Informe um e-mail válido.' };
  }

  try {
    const requester = dependencies.createRequester();
    const user = await requester.findAdminUserByEmail(email);
    if (user?.email) {
      await requester.requestPasswordRecovery(
        user.id,
        user.email,
        dependencies.recoveryRedirectUrl(),
      );
    }
    return { status: 'success', message: PASSWORD_RECOVERY_NEUTRAL_MESSAGE };
  } catch (error) {
    console.error('Public password recovery request failed.', { error });
    return {
      status: 'error',
      message: 'Não foi possível concluir a solicitação. Tente novamente.',
    };
  }
}
