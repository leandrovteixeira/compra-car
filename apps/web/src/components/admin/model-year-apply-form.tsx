'use client';
import { useActionState } from 'react';
import { applyModelYearFindingAction } from '@/app/admin/agents/model-year-actions';

export function ModelYearApplyForm({
  findingId,
  expectedFingerprint,
}: {
  readonly findingId: string;
  readonly expectedFingerprint: string;
}) {
  const [state, action, pending] = useActionState(applyModelYearFindingAction, {
    status: 'idle' as const,
    message: '',
  });
  return (
    <form action={action} className="ui-form-section space-y-3">
      <h2 className="text-lg font-semibold">Aplicar ano-modelo</h2>
      <p className="text-sm text-text-secondary">
        Cria o vínculo MMV × ano e materializa o Product como ativo e privado. Preço e
        especificações continuam separados.
      </p>
      <input type="hidden" name="findingId" value={findingId} />
      <input type="hidden" name="expectedFingerprint" value={expectedFingerprint} />
      <button
        className="ui-button ui-button--primary ui-button--commit"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Aplicando…' : 'Aplicar ano-modelo'}
      </button>
      {state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
