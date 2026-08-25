import Link from 'next/link';
import { cookies } from 'next/headers';

import { RECOVERY_ATTEMPT_COOKIE } from '@/auth/recovery-attempt';

import { confirmRecoveryAction } from './actions';

export default async function RecoveryConfirmationPage() {
  const hasAttempt = Boolean((await cookies()).get(RECOVERY_ATTEMPT_COOKIE)?.value);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Compra Car</p>
        <h1 className="mt-3 text-2xl font-semibold">Redefinir senha</h1>
        {hasAttempt ? (
          <>
            <p className="mt-5 text-slate-300">
              Clique em continuar para validar este pedido de redefinição.
            </p>
            <form action={confirmRecoveryAction} className="mt-6">
              <button className="min-h-12 w-full rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950">
                Continuar
              </button>
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
      </section>
    </main>
  );
}
