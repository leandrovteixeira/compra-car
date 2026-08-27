import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getActiveProfile } from '@/auth/authorization';
import { getSafeInternalDestination } from '@/auth/safe-redirect';
import { AuthShell } from '@/components/auth-shell';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';

import { login } from './actions';

interface LoginPageProps {
  readonly searchParams: Promise<{
    readonly error?: string | readonly string[];
    readonly next?: string | readonly string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const profile = await getActiveProfile();
  if (profile) redirect(profile.role === 'admin' ? '/admin' : '/');

  const rawNext = typeof params.next === 'string' ? params.next : undefined;
  const next = getSafeInternalDestination(rawNext, '');
  const hasError = typeof params.error === 'string';

  return (
    <AuthShell
      description="Entre com o e-mail e a senha cadastrados no Supabase Auth."
      title="Acesse sua conta"
    >
      {hasError ? (
        <p
          className="mt-5 rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          Não foi possível entrar. Verifique suas credenciais ou contate o administrador.
        </p>
      ) : null}

      <form action={login} className="mt-5 space-y-4">
        <input name="next" type="hidden" value={next} />
        <label className="block">
          <span className={labelClassName}>E-mail</span>
          <input
            autoComplete="email"
            className={`${fieldClassName} mt-1.5`}
            name="email"
            required
            type="email"
          />
        </label>
        <label className="block">
          <span className={labelClassName}>Senha</span>
          <input
            autoComplete="current-password"
            className={`${fieldClassName} mt-1.5`}
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <button className={buttonClassName({ fullWidth: true })} type="submit">
          Entrar
        </button>
      </form>
      <Link
        className="mt-5 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200"
        href="/forgot-password"
      >
        Esqueci minha senha
      </Link>
    </AuthShell>
  );
}
