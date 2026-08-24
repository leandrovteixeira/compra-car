'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PasswordLifecycleState } from '@/application/auth/password-lifecycle';
export function AuthPasswordForm({
  action,
  mode,
}: {
  readonly action: (
    state: PasswordLifecycleState,
    data: FormData,
  ) => Promise<PasswordLifecycleState>;
  readonly mode: 'invite' | 'recovery';
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { status: 'idle' });
  useEffect(() => {
    if (state.status === 'success' && state.destination) router.replace(state.destination);
  }, [router, state]);
  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <label className="text-sm font-medium">
        Nova senha
        <input
          autoComplete="new-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="text-sm font-medium">
        Confirmar senha
        <input
          autoComplete="new-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4"
          minLength={8}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {state.status !== 'idle' ? (
        <p
          className={
            state.status === 'error' ? 'text-sm text-rose-300' : 'text-sm text-emerald-300'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="min-h-12 rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? 'Salvando…' : mode === 'invite' ? 'Concluir cadastro' : 'Salvar nova senha'}
      </button>
    </form>
  );
}
