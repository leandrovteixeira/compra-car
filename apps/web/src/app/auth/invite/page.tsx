import Link from 'next/link';
import { AuthPasswordForm } from '@/components/auth-password-form';
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
          ? 'Seu acesso ao Compra Car está desativado.'
          : null;
  return (
    <AuthShell
      title="Defina sua senha"
      description="Crie uma senha para concluir seu acesso ao Compra Car."
    >
      {message ? (
        <>
          <p className="mt-5 text-rose-300" role="alert">
            {message}
          </p>
          <Link className="mt-6 inline-flex text-cyan-300" href="/login">
            Voltar ao login
          </Link>
        </>
      ) : (
        <AuthPasswordForm action={completeInviteAction} mode="invite" />
      )}
    </AuthShell>
  );
}
function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Compra Car</p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        {children}
      </section>
    </main>
  );
}
