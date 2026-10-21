'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { login } from '@/app/login/actions';

type DrawerMode = 'login' | 'signup';

export function AuthDrawer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<DrawerMode>('login');
  const open = searchParams.get('auth') === 'login';

  const returnTo = pathname + (searchParams.toString()
    ? '?' + new URLSearchParams([...searchParams.entries()].filter(([key]) => key !== 'auth')).toString()
    : '');

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('auth');
    const query = params.toString();
    window.history.replaceState(null, '', pathname + (query ? '?' + query : ''));
  }

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  // Closing always derives its destination from the current URL.
  }, [open, pathname, searchParams]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="presentation">
      <button
        aria-label="Fechar autenticação"
        type="button"
        className="absolute inset-0 bg-[#1A1D21]/60"
        onClick={close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-drawer-title"
        className="relative flex h-full w-full max-w-[485px] flex-col overflow-y-auto bg-white px-7 py-8 text-[#1A1D21] shadow-2xl sm:px-10"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={close}
          className="absolute right-5 top-5 p-2 text-2xl text-[#1A1D21]"
        >×</button>
        <h2 id="auth-drawer-title" className="mt-14 text-2xl font-semibold">
          Bem-vindo ao Compra Car
        </h2>
        <p className="mt-2 text-sm text-[#64707A]">
          Entre na sua conta para exportar e compartilhar comparações.
        </p>
        <div className="mt-9 flex border-b border-[#DEE3E6]">
          <button type="button" onClick={() => setMode('login')}
            aria-selected={mode === 'login'} role="tab"
            className={`w-1/2 border-b-[3px] py-3 text-sm ${mode === 'login' ? 'border-[#EF7732] font-semibold text-[#EF7732]' : 'border-transparent text-[#64707A]'}`}>
            Entrar
          </button>
          <button type="button" onClick={() => setMode('signup')}
            aria-selected={mode === 'signup'} role="tab"
            className={`w-1/2 border-b-[3px] py-3 text-sm ${mode === 'signup' ? 'border-[#EF7732] font-semibold text-[#EF7732]' : 'border-transparent text-[#64707A]'}`}>
            Criar conta
          </button>
        </div>
        {mode === 'login' ? (
          <form action={login} className="mt-9 flex flex-col gap-5">
            <input type="hidden" name="next" value={returnTo} />
            <label className="flex flex-col gap-2 text-sm font-medium">
              Email
              <input className="ui-field min-h-11" name="email" type="email" autoComplete="email" required />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Senha
              <input className="ui-field min-h-11" name="password" type="password" autoComplete="current-password" required />
            </label>
            <a href="/forgot-password" className="self-end text-sm text-[#EF7732]">Esqueci minha senha</a>
            <button type="submit" className="mt-2 min-h-12 rounded-lg bg-[#EF7732] text-center font-semibold text-white">
              Entrar
            </button>
          </form>
        ) : (
          <div className="mt-9">
            <p className="text-sm leading-6 text-[#64707A]">
              O cadastro gratuito será liberado após configurarmos a confirmação por email.
              Enquanto isso, você pode consultar fichas técnicas e comparar veículos sem entrar.
            </p>
            <button type="button" onClick={close}
              className="mt-7 min-h-12 w-full rounded-lg bg-[#EF7732] text-center font-semibold text-white">
              Continuar explorando
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
