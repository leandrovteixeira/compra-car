'use client';

import { useActionState } from 'react';
import { launchForceMmvAction, launchSourceMonitorAction } from '@/app/admin/agents/run-actions';

export function AgentRunLauncher({ brands }: { readonly brands: readonly string[] }) {
  const [state, action, pending] = useActionState(launchSourceMonitorAction, {
    status: 'idle' as const,
    message: '',
    jobId: null,
  });
  const [forceState, forceAction, forcePending] = useActionState(launchForceMmvAction, {
    status: 'idle' as const,
    message: '',
    jobId: null,
  });

  return (
    <>
    <form action={action} className="ui-form-section space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Monitorar fontes da marca</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Executa somente no QA. Primeiro compara as fontes oficiais de forma determinística; Brand Connector/MMV só rodam se houver mudança.
        </p>
      </div>

      <div className="max-w-md">
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
      </div>

      <p className="text-sm text-text-secondary">
        Primeira execução cria o baseline. Se nada mudou desde o último snapshot, nenhuma chamada de IA é feita.
      </p>

      <button
        className="ui-button ui-button--primary ui-button--commit"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Enfileirando monitoramento…' : 'Monitorar fontes'}
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
    <form action={forceAction} className="ui-form-section mt-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Force Run MMV — QA</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Ignora somente o gate de mudança de fonte. Executa MMV com IA e, ao concluir, Product Year reaproveita a evidência sem nova chamada de IA.
        </p>
      </div>
      <div className="max-w-md">
        <label className="ui-label">
          Marca
          <select className="ui-field" name="brand" required defaultValue="">
            <option value="" disabled>Selecione</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="ui-button ui-button--secondary ui-button--action"
        disabled={forcePending}
        type="submit"
      >
        {forcePending ? 'Enfileirando Force Run…' : 'Force Run MMV'}
      </button>
      {forceState.message ? (
        <div className="space-y-2">
          <p role={forceState.status === 'error' ? 'alert' : 'status'} className="text-sm">
            {forceState.message}
          </p>
          {forceState.jobId ? <p className="text-xs text-text-muted">Job: {forceState.jobId}</p> : null}
        </div>
      ) : null}
    </form>
    </>
  );
}
