import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { InviteOnboarding } from '@/components/invite-onboarding';
import { APP_NAME } from '@/config/app-identity';
import { loadPasswordFlowIdentity } from '@/server/password-lifecycle';
import { completeInviteAction } from './actions';
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const invalid = Boolean((await searchParams).error);
  const identity = invalid ? null : await loadPasswordFlowIdentity('invite');
  const message =
    invalid || !identity
      ? 'Este convite não é mais válido. Solicite um novo convite a um administrador.'
      : !identity.profile
        ? 'Não foi possível localizar seu perfil de acesso.'
        : identity.profile.status === 'disabled'
          ? `Seu acesso ao ${APP_NAME} está desativado.`
          : null;
  if (!message) return <InviteOnboarding action={completeInviteAction} />;

  return (
    <AuthShell
      title="Defina sua senha"
      description={`Crie uma senha para concluir seu acesso ao ${APP_NAME}.`}
    >
      <p className="mt-5 text-rose-300" role="alert">
        {message}
      </p>
      <Link className="mt-6 inline-flex font-semibold text-interactive" href="/login">
        Voltar ao login
      </Link>
    </AuthShell>
  );
}
