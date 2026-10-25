'use client';
import { useActionState } from 'react';
import { reviewAgentFindingAction } from '@/app/admin/agents/actions';
export function AgentReviewForm({ findingId }: { readonly findingId: string }) {
  const [state, action, pending] = useActionState(reviewAgentFindingAction, {
    status: 'idle' as const,
    message: '',
  });
  return (
    <form action={action} className="ui-form-section space-y-3">
      <h2 className="text-lg font-semibold">Decisão humana</h2>
      <p className="text-sm text-text-secondary">Esta decisão não altera o catálogo.</p>
      <input type="hidden" name="findingId" value={findingId} />
      <label className="ui-label" htmlFor="agent-review-note">
        Nota opcional
      </label>
      <textarea
        id="agent-review-note"
        name="note"
        maxLength={4000}
        rows={3}
        className="ui-field w-full"
        disabled={pending}
      />
      <fieldset disabled={pending} className="flex flex-wrap gap-2" aria-busy={pending}>
        <legend className="sr-only">Registrar decisão</legend>
        <button
          className="ui-button ui-button--primary ui-button--commit"
          type="submit"
          name="decision"
          value="ACCEPT"
        >
          Aceitar
        </button>
        <button
          type="submit"
          name="decision"
          value="REJECT"
          className="ui-button ui-button--destructive ui-button--commit"
        >
          Rejeitar
        </button>
        <button
          type="submit"
          name="decision"
          value="DEFER"
          className="ui-button ui-button--secondary ui-button--commit"
        >
          Adiar
        </button>
      </fieldset>
      {pending ? <p role="status">Registrando decisão…</p> : null}
      {state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
