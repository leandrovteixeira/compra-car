import { redirect } from 'next/navigation';

import { getActiveProfile } from '@/auth/authorization';
import { getSafeInternalDestination } from '@/auth/safe-redirect';

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
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Compra Car</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Acesse sua conta</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Entre com o e-mail e a senha cadastrados no Supabase Auth.
        </p>

        {hasError ? (
          <p
            className="mt-5 rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            Não foi possível entrar. Verifique suas credenciais ou contate o administrador.
          </p>
        ) : null}

        <form action={login} className="mt-6 space-y-5">
          <input name="next" type="hidden" value={next} />
          <label className="block">
            <span className="text-sm font-medium text-slate-200">E-mail</span>
            <input
              autoComplete="email"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Senha</span>
            <input
              autoComplete="current-password"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="min-h-12 w-full rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            type="submit"
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
