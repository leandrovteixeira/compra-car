'use client';
import { useActionState } from 'react';
import { applyMmvFindingAction } from '@/app/admin/agents/mmv-actions';

export function MmvApplyForm({
  findingId,
  expectedFingerprint,
}: {
  readonly findingId: string;
  readonly expectedFingerprint: string;
}) {
  const [state, action, pending] = useActionState(applyMmvFindingAction, {
    status: 'idle' as const,
    message: '',
  });
  return (
    <form action={action} className="ui-form-section space-y-3">
      <h2 className="text-lg font-semibold">Aplicar ao catálogo MMV</h2>
      <p className="text-sm text-text-secondary">
        Cria somente a identidade MMV canônica. Nenhum Product, PY ou MY será criado.
      </p>
      <input type="hidden" name="findingId" value={findingId} />
      <input type="hidden" name="expectedFingerprint" value={expectedFingerprint} />
      <button
        className="ui-button ui-button--primary ui-button--commit"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Aplicando…' : 'Aplicar MMV'}
      </button>
      {state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
