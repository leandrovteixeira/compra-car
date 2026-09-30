'use client';

import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';
import { useActionState, useEffect, useRef } from 'react';

import type { BrandMonitoringActionState } from '@/application/admin/brand-monitoring';
import { createMonitoredBrandAction } from '@/app/admin/brands/actions';

const INITIAL: BrandMonitoringActionState = { status: 'idle' };

export function AdminBrandCreate() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createMonitoredBrandAction, INITIAL);

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
        Nova marca
      </button>

      {state.status === 'success' ? (
        <p className="mt-2 text-sm text-emerald-300" role="status">
          {state.message}
        </p>
      ) : null}

      <dialog
        aria-labelledby="new-monitored-brand-title"
        className="m-auto w-[min(92vw,30rem)] rounded-lg border border-border bg-surface p-0 text-text-primary shadow-xl backdrop:bg-text-primary/50"
        ref={dialog}
      >
        <form action={action} className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold" id="new-monitored-brand-title">
            Adicionar marca monitorada
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Toda marca cadastrada aqui entra automaticamente no monitoramento do mercado brasileiro.
          </p>

          {state.status === 'error' ? (
            <p
              className="mt-4 rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-200"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}

          <div className="mt-5">
            <label className={labelClassName}>
              Marca
              <input
                autoComplete="off"
                autoFocus
                className={`${fieldClassName} mt-1.5`}
                maxLength={100}
                name="brand"
                placeholder="Ex.: Omoda"
                required
              />
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
              {pending ? 'Adicionando…' : 'Adicionar'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
