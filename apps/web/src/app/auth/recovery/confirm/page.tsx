import Link from 'next/link';
import { cookies } from 'next/headers';
import { buttonClassName } from '@compra-car/ui';

import { RECOVERY_ATTEMPT_COOKIE } from '@/auth/recovery-attempt';
import { AuthShell } from '@/components/auth-shell';

import { confirmRecoveryAction } from './actions';

export default async function RecoveryConfirmationPage() {
  const hasAttempt = Boolean((await cookies()).get(RECOVERY_ATTEMPT_COOKIE)?.value);

  return (
    <AuthShell title="Redefinir senha">
      {hasAttempt ? (
        <>
          <p className="mt-5 text-slate-300">
            Clique em continuar para validar este pedido de redefinição.
          </p>
          <form action={confirmRecoveryAction} className="mt-6">
            <button className={buttonClassName({ fullWidth: true })}>Continuar</button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-5 text-rose-300" role="alert">
            Este link de recuperação não é mais válido. Solicite uma nova redefinição de senha.
          </p>
          <Link className="mt-6 inline-flex text-cyan-300" href="/forgot-password">
            Solicitar nova redefinição
          </Link>
        </>
      )}
    </AuthShell>
  );
}
