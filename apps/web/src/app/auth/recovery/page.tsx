import Link from 'next/link';
import { AuthPasswordForm } from '@/components/auth-password-form';
import { loadPasswordFlowIdentity } from '@/server/password-lifecycle';
import { completeRecoveryAction } from './actions';
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const invalid = Boolean((await searchParams).error);
  const identity = invalid ? null : await loadPasswordFlowIdentity('recovery');
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Compra Car</p>
        <h1 className="mt-3 text-2xl font-semibold">Redefinir senha</h1>
        {!identity ? (
          <>
            <p className="mt-5 text-rose-300" role="alert">
              Este link de recuperação não é mais válido. Solicite uma nova redefinição de senha.
            </p>
            <Link className="mt-6 inline-flex text-cyan-300" href="/login">
              Voltar ao login
            </Link>
          </>
        ) : (
          <AuthPasswordForm action={completeRecoveryAction} mode="recovery" />
        )}
      </section>
    </main>
  );
}
