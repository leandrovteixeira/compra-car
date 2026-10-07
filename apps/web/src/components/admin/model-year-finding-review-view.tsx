import type { AgentFindingDetail, AgentObject } from '@compra-car/core/agent-platform';

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—';
}
function year(value: unknown): string {
  return typeof value === 'number' && Number.isInteger(value) ? String(value) : '—';
}
function operatorMessage(payload: AgentObject): string {
  return typeof payload.operatorMessage === 'string' && payload.operatorMessage.trim()
    ? payload.operatorMessage
    : 'Revise as evidências antes de decidir.';
}

export function ModelYearFindingReviewView({
  detail,
}: {
  readonly detail: AgentFindingDetail;
}) {
  const { finding } = detail;
  return (
    <section className="ui-surface space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Leitura para o operador</h2>
        <p className="text-sm text-text-secondary">
          {operatorMessage(finding.payload)}
        </p>
      </div>

      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-text-muted">Veículo</dt>
          <dd className="font-medium">
            {text(finding.subject.brand)} {text(finding.subject.model)}{' '}
            {text(finding.subject.officialVersionLabel)}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">MMV</dt>
          <dd className="font-medium">{text(finding.subject.mmvId)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Ano de fabricação</dt>
          <dd className="font-medium">{year(finding.subject.productionYear)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Ano-modelo</dt>
          <dd className="font-medium">{year(finding.subject.modelYear)}</dd>
        </div>
      </dl>

      <div className="space-y-1">
        <h3 className="font-medium">O que acontece se eu aceitar?</h3>
        <p className="text-sm text-text-secondary">
          Aceitar registra apenas a decisão. A alteração do catálogo só acontece no botão
          separado “Aplicar ano-modelo”.
        </p>
      </div>

      <details className="ui-surface p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Ver dados técnicos / JSON
        </summary>
        <div className="mt-3 space-y-3">
          <pre className="overflow-auto whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(
              {
                subject: finding.subject,
                proposal: finding.proposal,
                payload: finding.payload,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </details>
    </section>
  );
}
