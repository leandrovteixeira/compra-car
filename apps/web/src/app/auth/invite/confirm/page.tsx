import Link from 'next/link';
import { cookies } from 'next/headers';
import { buttonClassName } from '@compra-car/ui';

import { INVITE_ATTEMPT_COOKIE } from '@/auth/invite-attempt';
import { AuthShell } from '@/components/auth-shell';
import { APP_NAME } from '@/config/app-identity';

import { confirmInviteAction } from './actions';

export default async function InviteConfirmationPage() {
  const hasAttempt = Boolean((await cookies()).get(INVITE_ATTEMPT_COOKIE)?.value);

  return (
    <AuthShell title="Aceitar convite">
      {hasAttempt ? (
        <>
          <p className="mt-5 text-text-secondary">
            Clique em continuar para confirmar seu convite para o {APP_NAME}.
          </p>
          <form action={confirmInviteAction} className="mt-6">
            <button className={buttonClassName({ fullWidth: true })}>Aceitar convite</button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-5 text-rose-300" role="alert">
            Este convite não é mais válido. Solicite um novo convite a um administrador.
          </p>
          <Link className="mt-6 inline-flex font-semibold text-interactive" href="/login">
            Voltar ao login
          </Link>
        </>
      )}
    </AuthShell>
  );
}
