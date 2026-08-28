'use client';

import { APP_ROLES } from '@compra-car/contracts';
import { useActionState, useEffect, useRef } from 'react';

import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import { inviteAdminUserAction } from '@/app/admin/users/actions';
import { adminUserRoleLabel } from './admin-user-presentation';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';

const INITIAL: AdminUserActionState = { status: 'idle' };

export function AdminUserInvite() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(inviteAdminUserAction, INITIAL);
  useEffect(() => {
    if (state.status === 'success') dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        className={buttonClassName({ size: 'action', variant: 'interactive' })}
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
        className="m-auto w-[min(92vw,32rem)] rounded-lg border border-border bg-surface p-0 text-text-primary shadow-xl backdrop:bg-text-primary/50"
        ref={dialog}
      >
        <form action={action} className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold" id="invite-user-title">
            Convidar usuário
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
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
          <div className="mt-5 grid gap-4">
            <label className={labelClassName}>
              Nome
              <input
                autoComplete="name"
                className={`${fieldClassName} mt-1.5`}
                maxLength={160}
                name="fullName"
                required
              />
            </label>
            <label className={labelClassName}>
              E-mail
              <input
                autoComplete="email"
                className={`${fieldClassName} mt-1.5`}
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
            <label className={labelClassName}>
              Perfil
              <select className={`${fieldClassName} mt-1.5`} defaultValue="seller" name="role">
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {adminUserRoleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <button
              className={buttonClassName({ size: 'action', variant: 'secondary' })}
              onClick={() => dialog.current?.close()}
              type="button"
            >
              Cancelar
            </button>
            <button className={buttonClassName({ variant: 'interactive' })} disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
