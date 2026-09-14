import Link from 'next/link';
import {
  AGENT_TYPES,
  type AgentType,
  type AgentReviewFilter,
} from '@compra-car/core/agent-platform';
import { loadAgentQueue, loadAgentRuns } from '@/application/admin/agent-platform';
import {
  AgentFindingTable,
  AgentRunHistory,
  agentReviewLabels,
} from '@/components/admin/agent-platform-views';
import { PageHeader } from '@/components/admin/page-header';
export default async function AgentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    runs = params.tab === 'runs';
  const review =
    typeof params.review === 'string' && Object.hasOwn(agentReviewLabels, params.review)
      ? (params.review as AgentReviewFilter)
      : 'OPEN';
  const agentType =
    typeof params.agent === 'string' && AGENT_TYPES.includes(params.agent as AgentType)
      ? (params.agent as AgentType)
      : undefined;
  const rawPage = typeof params.page === 'string' ? Number(params.page) : 1;
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const options = { offset: (page - 1) * 25, limit: 25, agentType };
  const result = runs ? await loadAgentRuns(options) : await loadAgentQueue({ ...options, review });
  const link = (p: number) =>
    '/admin/agents?' +
    new URLSearchParams({
      tab: runs ? 'runs' : 'queue',
      review,
      ...(agentType ? { agent: agentType } : {}),
      page: String(p),
    }).toString();
  return (
    <>
      <PageHeader
        title="Agentes"
        description="Findings, evidências e decisões humanas. Esta decisão não altera o catálogo."
      />
      <div className="mt-5 space-y-5">
        <nav aria-label="Área de agentes" className="flex gap-2">
          <Link
            href="/admin/agents"
            aria-current={!runs ? 'page' : undefined}
            className="ui-button ui-button--secondary ui-button--action"
          >
            Fila de revisão
          </Link>
          <Link
            href="/admin/agents?tab=runs"
            aria-current={runs ? 'page' : undefined}
            className="ui-button ui-button--secondary ui-button--action"
          >
            Runs
          </Link>
          <Link
            href="/admin/agents/brands"
            className="ui-button ui-button--secondary ui-button--action"
          >
            Marcas
          </Link>
        </nav>
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value={runs ? 'runs' : 'queue'} />
          {!runs ? (
            <label className="ui-label">
              Revisão
              <select className="ui-field" name="review" defaultValue={review}>
                {Object.entries(agentReviewLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="ui-label">
            Agente
            <select className="ui-field" name="agent" defaultValue={agentType ?? ''}>
              <option value="">Todos os agentes</option>
              {AGENT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <button className="ui-button ui-button--secondary ui-button--action" type="submit">
            Filtrar
          </button>
        </form>
        {runs ? (
          <AgentRunHistory items={(result as Awaited<ReturnType<typeof loadAgentRuns>>).items} />
        ) : (
          <AgentFindingTable items={(result as Awaited<ReturnType<typeof loadAgentQueue>>).items} />
        )}
        <nav aria-label="Paginação" className="flex items-center gap-4 text-sm">
          {page > 1 ? <Link href={link(page - 1)}>Anterior</Link> : null}
          <span>
            Página {page} · {result.total} registros
          </span>
          {page * 25 < result.total ? <Link href={link(page + 1)}>Próxima</Link> : null}
        </nav>
      </div>
    </>
  );
}
