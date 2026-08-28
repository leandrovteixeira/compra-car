'use client';

import { useActionState } from 'react';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';

import type { PasswordRecoveryRequestState } from '@/application/auth/request-password-recovery';
import { requestPasswordRecoveryAction } from '@/app/forgot-password/actions';

const INITIAL: PasswordRecoveryRequestState = { status: 'idle' };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordRecoveryAction, INITIAL);

  return (
    <form action={action} className="mt-5 space-y-4">
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
      {state.status !== 'idle' ? (
        <p
          className={
            state.status === 'error'
              ? 'rounded-md border border-status-error/30 bg-rose-950/10 p-2.5 text-sm text-status-error'
              : 'rounded-md border border-status-success/30 bg-emerald-950/10 p-2.5 text-sm text-status-success'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      ) : null}
      <button
        className={buttonClassName({ fullWidth: true, variant: 'interactive' })}
        disabled={pending}
      >
        {pending ? 'Enviando…' : 'Enviar instruções'}
      </button>
    </form>
  );
}
