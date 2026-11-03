import type { AgentControlCenterSummary } from '@/application/admin/agent-control-center';
import { agentDate } from './agent-platform-views';

const statusLabel = {
  HEALTHY: 'Saudável',
  ATTENTION: 'Atenção',
  IDLE: 'Sem atividade',
} as const;

export function AgentControlCenterOverview({
  summary,
}: {
  readonly summary: AgentControlCenterSummary;
}) {
  return (
    <section className="space-y-4" aria-labelledby="agent-control-center-title">
      <div>
        <h2 id="agent-control-center-title" className="text-lg font-semibold">
          Visão geral
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Saúde operacional e decisões pendentes. Falha de execução não é a mesma coisa que finding para revisão.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="ui-surface p-4">
          <p className="text-xs text-text-muted">Aguardando decisão</p>
          <p className="mt-1 text-2xl font-semibold">{summary.pendingDecisions}</p>
        </div>
        <div className="ui-surface p-4">
          <p className="text-xs text-text-muted">Agentes com atenção</p>
          <p className="mt-1 text-2xl font-semibold">{summary.operationalFailures}</p>
        </div>
        <div className="ui-surface p-4">
          <p className="text-xs text-text-muted">Jobs ativos</p>
          <p className="mt-1 text-2xl font-semibold">{summary.activeJobs}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summary.families.map((family) => (
          <article key={family.key} className="ui-surface space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{family.label}</h3>
              <span className="text-xs text-text-muted">{statusLabel[family.status]}</span>
            </div>
            <div>
              <p className="text-2xl font-semibold">{family.pending}</p>
              <p className="text-xs text-text-muted">pendente(s) de decisão</p>
            </div>
            <p className="text-sm text-text-secondary">{family.detail}</p>
            <p className="text-xs text-text-muted">
              Última atividade: {agentDate(family.lastActivityAt)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
