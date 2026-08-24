import 'server-only';
import type { AuthProfile, AuthUser } from '@compra-car/adapter-supabase';
export type PasswordLifecycleState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly message: string; readonly destination?: string };
export interface PasswordLifecycleIdentity {
  readonly user: AuthUser;
  readonly profile: AuthProfile | null;
}
export interface PasswordLifecycleDependencies {
  readonly identity: () => Promise<PasswordLifecycleIdentity | null>;
  readonly updatePassword: (password: string) => Promise<boolean>;
  readonly activatePending: (id: string) => Promise<boolean>;
}
function validate(data: FormData): { password: string } | PasswordLifecycleState {
  const p = data.get('password'),
    c = data.get('confirmation');
  const password = typeof p === 'string' ? p : '';
  if (password.length < 8)
    return { status: 'error', message: 'A senha deve ter pelo menos 8 caracteres.' };
  if (password !== (typeof c === 'string' ? c : ''))
    return { status: 'error', message: 'As senhas informadas não coincidem.' };
  return { password };
}
export async function completeInvitedUserOnboarding(
  data: FormData,
  d: PasswordLifecycleDependencies,
): Promise<PasswordLifecycleState> {
  const valid = validate(data);
  if ('status' in valid) return valid;
  const identity = await d.identity();
  if (!identity) return { status: 'error', message: 'Este convite não é mais válido.' };
  if (!identity.profile)
    return { status: 'error', message: 'Não foi possível localizar seu perfil de acesso.' };
  if (identity.profile.status === 'disabled')
    return { status: 'error', message: 'Seu acesso ao Compra Car está desativado.' };
  if (identity.profile.status === 'active')
    return { status: 'success', message: 'Cadastro já concluído.', destination: '/' };
  if (!(await d.updatePassword(valid.password)))
    return {
      status: 'error',
      message: 'Não foi possível definir a senha. Solicite um novo convite.',
    };
  try {
    if (!(await d.activatePending(identity.user.id))) throw new Error('not pending');
  } catch {
    return {
      status: 'error',
      message:
        'Sua senha foi definida, mas não foi possível concluir a ativação do acesso. Tente novamente ou contate um administrador.',
    };
  }
  return { status: 'success', message: 'Cadastro concluído.', destination: '/' };
}
export async function completePasswordRecovery(
  data: FormData,
  d: PasswordLifecycleDependencies,
): Promise<PasswordLifecycleState> {
  const valid = validate(data);
  if ('status' in valid) return valid;
  const identity = await d.identity();
  if (!identity) return { status: 'error', message: 'Este link de recuperação não é mais válido.' };
  if (!identity.profile)
    return { status: 'error', message: 'Não foi possível localizar seu perfil de acesso.' };
  if (!(await d.updatePassword(valid.password)))
    return {
      status: 'error',
      message: 'Não foi possível atualizar a senha. Solicite uma nova redefinição.',
    };
  const message =
    identity.profile.status === 'disabled'
      ? 'Senha atualizada. Seu acesso ao Compra Car continua desativado.'
      : identity.profile.status === 'pending'
        ? 'Senha atualizada. Seu cadastro ainda aguarda conclusão.'
        : 'Senha atualizada com sucesso.';
  return {
    status: 'success',
    message,
    destination: identity.profile.status === 'active' ? '/' : undefined,
  };
}
