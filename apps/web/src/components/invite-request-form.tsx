'use client';
import { buttonClassName, fieldClassName, labelClassName, surfaceClassName } from '@compra-car/ui';
import { useActionState } from 'react';
import { createInviteRequestAction } from '@/app/(seller)/invite-requests/actions';
export function InviteRequestForm() {
  const [state, action, pending] = useActionState(createInviteRequestAction, {
    status: 'idle',
  } as const);
  return (
    <form action={action} className={surfaceClassName}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClassName}>
          Nome
          <input className={`${fieldClassName} mt-1.5`} maxLength={160} name="name" required />
        </label>
        <label className={labelClassName}>
          E-mail
          <input
            className={`${fieldClassName} mt-1.5`}
            maxLength={254}
            name="email"
            required
            type="email"
          />
        </label>
      </div>
      {state.status !== 'idle' ? (
        <p
          className={`mt-4 text-sm ${state.status === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      ) : null}
      <button className={`${buttonClassName()} mt-4`} disabled={pending}>
        {pending ? 'Enviando…' : 'Solicitar convite'}
      </button>
    </form>
  );
}
