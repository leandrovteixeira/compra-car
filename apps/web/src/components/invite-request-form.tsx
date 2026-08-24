'use client';
import { useActionState } from 'react';
import { createInviteRequestAction } from '@/app/(seller)/invite-requests/actions';
export function InviteRequestForm() {
  const [state, action, pending] = useActionState(createInviteRequestAction, {
    status: 'idle',
  } as const);
  return (
    <form action={action} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Nome
          <input
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"
            maxLength={160}
            name="name"
            required
          />
        </label>
        <label>
          E-mail
          <input
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"
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
      <button
        className="mt-5 min-h-11 rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? 'Enviando…' : 'Solicitar convite'}
      </button>
    </form>
  );
}
