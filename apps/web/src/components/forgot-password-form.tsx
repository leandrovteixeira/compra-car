'use client';

import { useActionState } from 'react';

import type { PasswordRecoveryRequestState } from '@/application/auth/request-password-recovery';
import { requestPasswordRecoveryAction } from '@/app/forgot-password/actions';

const INITIAL: PasswordRecoveryRequestState = { status: 'idle' };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordRecoveryAction, INITIAL);

  return (
    <form action={action} className="mt-6 space-y-5">
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
        className="min-h-12 w-full rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? 'Enviando…' : 'Enviar instruções'}
      </button>
    </form>
  );
}
