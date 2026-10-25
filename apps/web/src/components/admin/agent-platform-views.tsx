import Link from 'next/link';
import { safeConnectorUrl } from '@compra-car/core/agents';
import { BrandConnectorView } from './brand-connector-view';
import { MmvFindingReviewView } from './mmv-finding-review-view';
import { ModelYearFindingReviewView } from './model-year-finding-review-view';
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
function asAgentObject(value: unknown): AgentObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as AgentObject)
    : null;
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
                {typeof finding.payload.reasonCode === 'string' ? (
                  <span className="block text-xs text-text-muted">{finding.payload.reasonCode}</span>
                ) : null}
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
function BrandIdentityReview({ payload, subject }: {
  readonly payload: AgentObject;
  readonly subject: AgentObject;
}) {
  const canonicalBrand =
    typeof payload.canonicalBrand === 'string' ? payload.canonicalBrand : null;
  const targetBrand = typeof subject.brand === 'string' ? subject.brand : null;
  const aliases = Array.isArray(payload.aliases)
    ? payload.aliases.filter(
        (item): item is AgentObject =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      )
    : [];

  if (!canonicalBrand && !aliases.length) return null;

  return (
    <section className="ui-surface space-y-3 p-4">
      <div>
        <h2 className="text-lg font-semibold">Identidade da marca</h2>
        <p className="text-sm text-text-secondary">
          A identidade e os aliases só entram no registry após revisão e ativação do connector.
        </p>
      </div>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-text-muted">Target operacional</dt>
          <dd className="font-medium">{targetBrand ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Marca canônica proposta</dt>
          <dd className="font-medium">{canonicalBrand ?? '—'}</dd>
        </div>
      </dl>
      <div>
        <h3 className="font-medium">Aliases propostos</h3>
        {!aliases.length ? (
          <p className="mt-1 text-sm text-text-muted">Nenhum alias proposto.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {aliases.map((alias, index) => {
              const value = typeof alias.alias === 'string' ? alias.alias : '—';
              const aliasType =
                typeof alias.aliasType === 'string' ? alias.aliasType : '—';
              const confidenceValue =
                typeof alias.confidence === 'number' ? alias.confidence : null;
              const evidenceUrl =
                typeof alias.evidenceUrl === 'string'
                  ? safeConnectorUrl(alias.evidenceUrl)
                  : null;
              return (
                <li key={index} className="space-y-1 py-2">
                  <p>
                    <strong>{value}</strong> · {aliasType}
                    {confidenceValue !== null
                      ? ' · ' + confidence(confidenceValue)
                      : ''}
                  </p>
                  {typeof alias.evidenceExcerpt === 'string' ? (
                    <p className="text-sm text-text-secondary">
                      {alias.evidenceExcerpt}
                    </p>
                  ) : null}
                  {evidenceUrl ? (
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline underline-offset-2"
                    >
                      Evidência do alias
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function AgentFindingDetailView({ detail }: { readonly detail: AgentFindingDetail }) {
  const { finding, run, evidence, reviews, latestReview } = detail;
  const evidenceAssessment = asAgentObject(finding.payload.evidenceAssessment);
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
      {typeof finding.payload.reasonCode === 'string' ? (
        <p className="text-sm">Motivo: <strong>{finding.payload.reasonCode}</strong></p>
      ) : null}
      {evidenceAssessment ? (
        <p className="text-sm">
          Evidência:{' '}
          <strong>{String(evidenceAssessment.readiness ?? '—')}</strong>
          {' · '}
          {String(evidenceAssessment.corroborationLevel ?? '—')}
          {' · '}
          {evidenceAssessment.automationEligible === false ? 'validação humana' : '—'}
        </p>
      ) : null}
      <Link
        className="ui-button ui-button--ghost ui-button--action"
        href={'/admin/agents/runs/' + run.id}
      >
        Run {run.agentType} · {agentDate(run.startedAt)}
      </Link>
      {run.agentType === 'PRODUCT_YEAR' ? null : (
        <AgentDetails title="Identidade observada" value={finding.subject} />
      )}
      {['NEW_BRAND_CONNECTOR', 'CONNECTOR_DRIFT'].includes(finding.findingType) ? (
        <>
          <BrandIdentityReview payload={finding.payload} subject={finding.subject} />
          <BrandConnectorView value={finding.proposal} />
          {typeof finding.payload.observedBrandLabel === 'string' ? (
            <p>Nome oficial observado (informativo): {finding.payload.observedBrandLabel}</p>
          ) : null}
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
      ) : run.agentType === 'MMV_DISCOVERY' ? (
        <MmvFindingReviewView detail={detail} />
      ) : run.agentType === 'PRODUCT_YEAR' ? (
        <ModelYearFindingReviewView detail={detail} />
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
