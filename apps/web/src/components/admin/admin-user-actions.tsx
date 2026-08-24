'use client';

import { APP_ROLES, type AdminUserDto } from '@compra-car/contracts';
import { useActionState, useEffect, useRef } from 'react';

import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import {
  sendAdminUserPasswordRecoveryAction,
  setAdminUserRoleAction,
  setAdminUserStatusAction,
} from '@/app/admin/users/actions';
import { adminUserRoleLabel } from './admin-user-presentation';

const INITIAL: AdminUserActionState = { status: 'idle' };
const buttonClass =
  'min-h-10 w-full rounded-lg border border-slate-700 px-3 text-left text-sm font-semibold disabled:opacity-60';
function Feedback({ state }: { readonly state: AdminUserActionState }) {
  if (state.status === 'idle') return null;
  return (
    <p
      className={state.status === 'error' ? 'text-xs text-rose-300' : 'text-xs text-emerald-300'}
      role={state.status === 'error' ? 'alert' : 'status'}
    >
      {state.message}
    </p>
  );
}

export function AdminUserActions({ user }: { readonly user: AdminUserDto }) {
  const disableDialog = useRef<HTMLDialogElement>(null);
  const roleDialog = useRef<HTMLDialogElement>(null);
  const [statusState, statusAction, statusPending] = useActionState(
    setAdminUserStatusAction,
    INITIAL,
  );
  const [roleState, roleAction, rolePending] = useActionState(setAdminUserRoleAction, INITIAL);
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(
    sendAdminUserPasswordRecoveryAction,
    INITIAL,
  );
  const healthy = user.profileState === 'valid';
  const label = user.fullName || user.email || 'este usuário';

  useEffect(() => {
    if (statusState.status === 'success') disableDialog.current?.close();
  }, [statusState]);
  useEffect(() => {
    if (roleState.status === 'success') roleDialog.current?.close();
  }, [roleState]);
  return (
    <details className="relative">
      <summary
        aria-label={`Ações para ${label}`}
        className="inline-grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-slate-700 text-xl"
      >
        ⋯
      </summary>
      <div className="z-10 mt-2 grid min-w-64 gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl md:absolute md:right-0">
        {healthy ? (
          <>
            <button
              className={buttonClass}
              onClick={() => roleDialog.current?.showModal()}
              type="button"
            >
              Alterar perfil
            </button>
            {user.status === 'active' ? (
              <button
                className={`${buttonClass} border-rose-800 text-rose-300`}
                onClick={() => disableDialog.current?.showModal()}
                type="button"
              >
                Desativar acesso
              </button>
            ) : user.status === 'disabled' ? (
              <form action={statusAction}>
                <input name="userId" type="hidden" value={user.id} />
                <input name="status" type="hidden" value="active" />
                <button
                  className={`${buttonClass} border-emerald-800 text-emerald-300`}
                  disabled={statusPending}
                >
                  Ativar acesso
                </button>
              </form>
            ) : null}
            <Feedback state={statusState} />
          </>
        ) : (
          <p className="text-xs leading-5 text-amber-300">
            Perfil inconsistente: alterações de perfil e status indisponíveis.
          </p>
        )}
        {user.email ? (
          <form action={recoveryAction}>
            <input name="userId" type="hidden" value={user.id} />
            <button className={buttonClass} disabled={recoveryPending}>
              Redefinir senha
            </button>
          </form>
        ) : null}
        <Feedback state={recoveryState} />
      </div>
      <dialog
        aria-labelledby={`disable-${user.id}`}
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-slate-950/85"
        ref={disableDialog}
      >
        <h2 className="text-xl font-bold" id={`disable-${user.id}`}>
          Desativar acesso de {label}?
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          O usuário não poderá acessar o Compra Car enquanto estiver inativo.
        </p>
        <form action={statusAction} className="mt-6 flex justify-end gap-3">
          <input name="userId" type="hidden" value={user.id} />
          <input name="status" type="hidden" value="disabled" />
          <button
            className="min-h-11 rounded-xl border border-slate-700 px-4"
            onClick={() => disableDialog.current?.close()}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="min-h-11 rounded-xl bg-rose-600 px-4 font-semibold"
            disabled={statusPending}
          >
            Desativar acesso
          </button>
        </form>
      </dialog>
      <dialog
        aria-labelledby={`role-${user.id}`}
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-slate-950/85"
        ref={roleDialog}
      >
        <h2 className="text-xl font-bold" id={`role-${user.id}`}>
          Alterar perfil de {label}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          A redução de privilégios será validada no servidor.
        </p>
        <form action={roleAction} className="mt-5">
          <input name="userId" type="hidden" value={user.id} />
          <select
            className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"
            defaultValue={user.role ?? ''}
            name="role"
          >
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {adminUserRoleLabel(role)}
              </option>
            ))}
          </select>
          <Feedback state={roleState} />
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="min-h-11 rounded-xl border border-slate-700 px-4"
              onClick={() => roleDialog.current?.close()}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-xl bg-sky-500 px-4 font-semibold text-slate-950"
              disabled={rolePending}
            >
              Salvar perfil
            </button>
          </div>
        </form>
      </dialog>
    </details>
  );
}
