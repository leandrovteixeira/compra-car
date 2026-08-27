import Link from 'next/link';
import { AuthPasswordForm } from '@/components/auth-password-form';
import { AuthShell } from '@/components/auth-shell';
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
    <AuthShell title="Redefinir senha">
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
    </AuthShell>
  );
}
