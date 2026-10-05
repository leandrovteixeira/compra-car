'use client';

import { useActionState } from 'react';
import { launchMmvDiscoveryAction } from '@/app/admin/agents/run-actions';

export function AgentRunLauncher({ brands }: { readonly brands: readonly string[] }) {
  const [state, action, pending] = useActionState(launchMmvDiscoveryAction, {
    status: 'idle' as const,
    message: '',
    jobId: null,
  });

  return (
    <form action={action} className="ui-form-section space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Executar MMV Discovery</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Executa somente no QA, persiste findings e não altera o catálogo automaticamente.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="ui-label">
          Marca
          <select className="ui-field" name="brand" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </label>

        <label className="ui-label md:col-span-2">
          Modelo específico para FIPE / mercado (opcional)
          <input
            className="ui-field"
            name="marketModel"
            maxLength={200}
            placeholder="Ex.: Niro"
            disabled={pending}
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="marketReconcile"
          defaultChecked
          disabled={pending}
          className="mt-1"
        />
        <span>
          Reconciliar FIPE / mercado para findings novos. Se um modelo específico for informado,
          limita a reconciliação a ele.
        </span>
      </label>

      <button
        className="ui-button ui-button--primary ui-button--commit"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Executando… pode levar alguns minutos' : 'Executar agente'}
      </button>

      {state.message ? (
        <div className="space-y-2">
          <p role={state.status === 'error' ? 'alert' : 'status'} className="text-sm">
            {state.message}
          </p>
          {state.jobId ? (
            <p className="text-xs text-text-muted">Job: {state.jobId}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
