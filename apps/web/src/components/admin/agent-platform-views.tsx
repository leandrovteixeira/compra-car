import Link from 'next/link';
import { safeConnectorUrl } from '@compra-car/core/agents';
import { BrandConnectorView } from './brand-connector-view';
import {
  safeAgentSourceUrl,
  type AgentFindingListItem,
  type AgentRunListItem,
  type AgentRunBundle,
  type AgentFindingDetail,
  type AgentObject,
} from '@compra-car/core/agent-platform';
import { EmptyState } from './empty-state';
export const agentReviewLabels = {
  OPEN: 'Abertos',
  ACCEPT: 'Aceitos',
  REJECT: 'Rejeitados',
  DEFER: 'Adiados',
  ALL: 'Todos',
} as const;
export function agentDate(value: string | null): string {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(value))
    : '—';
}
const confidence = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value);
export function AgentDetails({
  title,
  value,
}: {
  readonly title: string;
  readonly value: AgentObject | null;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {value ? (
        <pre className="ui-surface overflow-auto whitespace-pre-wrap break-words p-3 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-text-muted">Nenhuma proposta.</p>
      )}
    </section>
  );
}
export function AgentFindingTable({ items }: { readonly items: readonly AgentFindingListItem[] }) {
  if (!items.length)
    return (
      <EmptyState
        title="Nenhum finding nesta fila"
        description="Não há findings aguardando revisão neste filtro."
      />
    );
  return (
    <div className="ui-table-frame overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {[
              'Agente / tipo',
              'Assunto / marca',
              'Confiança',
              'Data da run',
              'Revisão atual',
              '',
            ].map((label, i) => (
              <th key={i} scope="col" className="p-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(({ finding, run, latestReview }) => (
            <tr key={finding.id}>
              <td className="p-3">
                <span className="block text-xs text-text-muted">{run.agentType}</span>
                {finding.findingType}
              </td>
              <td className="p-3">
                <span className="block font-medium">{finding.title}</span>
                {run.brand ?? '—'}
              </td>
              <td className="p-3">{confidence(finding.confidence)}</td>
              <td className="p-3 whitespace-nowrap">{agentDate(run.startedAt)}</td>
              <td className="p-3">
                {latestReview
                  ? agentReviewLabels[latestReview.decision]
                  : finding.requiresReview
                    ? 'Aberto'
                    : 'Informativo'}
              </td>
              <td className="p-3">
                <Link
                  className="ui-button ui-button--ghost ui-button--action"
                  href={'/admin/agents/findings/' + finding.id}
                >
                  Abrir / revisar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AgentRunHistory({ items }: { readonly items: readonly AgentRunListItem[] }) {
  if (!items.length)
    return (
      <EmptyState
        title="Nenhuma run registrada"
        description="Execuções persistidas aparecerão aqui."
      />
    );
  return (
    <div className="ui-table-frame overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {[
              'Execução',
              'Escopo / provider',
              'Estado',
              'Findings / revisão',
              'Aceitos / rejeitados / adiados',
              '',
            ].map((label, i) => (
              <th key={i} scope="col" className="p-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(({ run, counts }) => (
            <tr key={run.id}>
              <td className="p-3">
                {run.agentType}
                <span className="block text-xs">Início: {agentDate(run.startedAt)}</span>
                <span className="block text-xs">Fim: {agentDate(run.completedAt)}</span>
              </td>
              <td className="p-3">
                {run.brand ?? '—'} / {run.market ?? '—'}
                <span className="block text-xs">{run.provider ?? '—'}</span>
              </td>
              <td className="p-3">{run.status}</td>
              <td className="p-3">
                {counts.total} / {counts.reviewRequired}
              </td>
              <td className="p-3">
                {counts.accepted} / {counts.rejected} / {counts.deferred}
              </td>
              <td className="p-3">
                <Link
                  className="ui-button ui-button--ghost ui-button--action"
                  href={'/admin/agents/runs/' + run.id}
                >
                  Abrir run
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AgentRunDetail({ bundle }: { readonly bundle: AgentRunBundle }) {
  const { run } = bundle;
  const items = bundle.findings.map(({ finding }) => ({ finding, run, latestReview: null }));
  return (
    <div className="space-y-6">
      <AgentDetails
        title="Execução"
        value={{
          id: run.id,
          agentType: run.agentType,
          status: run.status,
          brand: run.brand,
          market: run.market,
          provider: run.provider,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          runMode: run.runMode,
          schemaVersion: run.schemaVersion,
          sourceCommitSha: run.sourceCommitSha,
        }}
      />
      <AgentDetails title="Resumo" value={run.summary} />
      <AgentDetails title="Entrada" value={run.input} />
      <AgentDetails title="Configuração" value={run.configSnapshot} />
      {run.error ? <AgentDetails title="Erro operacional" value={run.error} /> : null}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Exigem revisão</h2>
        <ul className="divide-y divide-border">
          {items
            .filter((i) => i.finding.requiresReview)
            .map((i) => (
              <li key={i.finding.id} className="py-3">
                <Link href={'/admin/agents/findings/' + i.finding.id}>
                  {i.finding.findingType} — {i.finding.title}
                </Link>
              </li>
            ))}
        </ul>
        {!items.some((i) => i.finding.requiresReview) ? <p>Nenhum finding exige revisão.</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Informativos</h2>
        <AgentFindingTable items={items.filter((i) => !i.finding.requiresReview)} />
      </section>
    </div>
  );
}
export function AgentFindingDetailView({ detail }: { readonly detail: AgentFindingDetail }) {
  const { finding, run, evidence, reviews, latestReview } = detail;
  return (
    <div className="space-y-6">
      <p className="text-sm">
        {finding.findingType} · Confiança: {confidence(finding.confidence)} ·{' '}
        {latestReview
          ? agentReviewLabels[latestReview.decision]
          : finding.requiresReview
            ? 'Aberto'
            : 'Informativo'}
      </p>
      <p className="text-sm text-text-secondary">{finding.summary}</p>
      <Link
        className="ui-button ui-button--ghost ui-button--action"
        href={'/admin/agents/runs/' + run.id}
      >
        Run {run.agentType} · {agentDate(run.startedAt)}
      </Link>
      <AgentDetails title="Identidade observada" value={finding.subject} />
      {['NEW_BRAND_CONNECTOR', 'CONNECTOR_DRIFT'].includes(finding.findingType) ? (
        <>
          <BrandConnectorView value={finding.proposal} />
          <section>
            <h2 className="text-lg font-semibold">Avisos</h2>
            <ul>
              {Array.isArray(finding.payload.warnings)
                ? finding.payload.warnings
                    .filter((w) => typeof w === 'string')
                    .map((w, i) => <li key={i}>{String(w)}</li>)
                : null}
            </ul>
            <p>Accept registra a revisão. Ativar connector é uma ação separada.</p>
          </section>
        </>
      ) : (
        <>
          <AgentDetails title="Ação proposta (informativa)" value={finding.proposal} />
          <AgentDetails title="Avisos e detalhes" value={finding.payload} />
        </>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Evidências</h2>
        {!evidence.length ? (
          <p>Nenhuma evidência.</p>
        ) : (
          <ul className="divide-y divide-border">
            {evidence.map((e) => {
              const url =
                run.agentType === 'BRAND_CONNECTOR'
                  ? safeConnectorUrl(e.sourceUrl)
                  : safeAgentSourceUrl(e.sourceUrl);
              return (
                <li key={e.id} className="space-y-2 py-3">
                  <p className="text-xs text-text-muted">
                    {e.sourceType} · {e.sourceDomain ?? '—'}
                  </p>
                  <p className="font-medium">{e.title ?? 'Fonte sem título'}</p>
                  {e.excerpt ? (
                    <p className="whitespace-pre-wrap break-words text-sm">{e.excerpt}</p>
                  ) : null}
                  {url ? (
                    <a
                      className="ui-button ui-button--ghost ui-button--action"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir fonte
                    </a>
                  ) : (
                    <p className="text-sm">Link indisponível: URL inválida.</p>
                  )}
                  <p className="text-xs text-text-muted">Captura: {agentDate(e.capturedAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de revisão</h2>
        {!reviews.length ? (
          <p>Nenhuma revisão registrada.</p>
        ) : (
          <ol className="divide-y divide-border">
            {reviews.map((review) => (
              <li key={review.id} className="space-y-1 py-3">
                <p>
                  {agentReviewLabels[review.decision]} · {agentDate(review.createdAt)}
                </p>
                <p className="break-all text-xs text-text-muted">
                  Revisor: {review.reviewedBy ?? 'Não identificado'}
                </p>
                {review.note ? (
                  <p className="whitespace-pre-wrap break-words text-sm">{review.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
