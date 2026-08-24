'use client';

import { APP_ROLES } from '@compra-car/contracts';
import { useActionState, useEffect, useRef } from 'react';

import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import { inviteAdminUserAction } from '@/app/admin/users/actions';
import { adminUserRoleLabel } from './admin-user-presentation';

const INITIAL: AdminUserActionState = { status: 'idle' };
const fieldClass =
  'mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-500';

export function AdminUserInvite() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(inviteAdminUserAction, INITIAL);
  useEffect(() => {
    if (state.status === 'success') dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        className="min-h-11 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950"
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        Novo usuário
      </button>
      {state.status === 'success' ? (
        <p className="mt-2 text-sm text-emerald-300" role="status">
          {state.message}
        </p>
      ) : null}
      <dialog
        aria-labelledby="invite-user-title"
        className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85"
        ref={dialog}
      >
        <form action={action} className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold" id="invite-user-title">
            Convidar usuário
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            O usuário receberá um convite para definir seu acesso.
          </p>
          {state.status === 'error' ? (
            <p
              className="mt-4 rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-200"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}
          <div className="mt-6 grid gap-5">
            <label className="text-sm font-semibold">
              Nome
              <input
                autoComplete="name"
                className={fieldClass}
                maxLength={160}
                name="fullName"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              E-mail
              <input
                autoComplete="email"
                className={fieldClass}
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
            <label className="text-sm font-semibold">
              Perfil
              <select className={fieldClass} defaultValue="seller" name="role">
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {adminUserRoleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-7 flex justify-end gap-3 border-t border-slate-800 pt-5">
            <button
              className="min-h-11 rounded-xl border border-slate-700 px-4"
              onClick={() => dialog.current?.close()}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-xl bg-sky-500 px-4 font-semibold text-slate-950 disabled:opacity-60"
              disabled={pending}
            >
              {pending ? 'Enviando…' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
