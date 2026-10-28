import Link from 'next/link';
import {
  AGENT_TYPES,
  type AgentType,
  type AgentReviewFilter,
} from '@compra-car/core/agent-platform';
import { canonicalVehicleBrand } from '@compra-car/core/agents';
import { loadAgentQueue, loadAgentRuns } from '@/application/admin/agent-platform';
import { loadAgentJobs } from '@/application/admin/agent-runner';
import { loadBrandTargets } from '@/application/admin/brand-connectors';
import { loadAgentControlCenterSummary } from '@/application/admin/agent-control-center';
import {
  AgentFindingTable,
  AgentRunHistory,
  agentReviewLabels,
} from '@/components/admin/agent-platform-views';
import { AgentControlCenterOverview } from '@/components/admin/agent-control-center-overview';
import { AgentRunLauncher } from '@/components/admin/agent-run-launcher';
import { AgentJobQueue } from '@/components/admin/agent-job-queue';
import { PageHeader } from '@/components/admin/page-header';

type AgentTab = 'overview' | 'review' | 'runs' | 'controls';

export default async function AgentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab: AgentTab =
    params.tab === 'review' || params.tab === 'runs' || params.tab === 'controls'
      ? params.tab
      : 'overview';

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

  const [controlCenter, result, brandTargets, jobs] = await Promise.all([
    loadAgentControlCenterSummary(),
    tab === 'runs'
      ? loadAgentRuns(options)
      : tab === 'review'
        ? loadAgentQueue({ ...options, review })
        : Promise.resolve({ items: [], total: 0 }),
    tab === 'controls' && process.env.APP_ENV === 'qa'
      ? loadBrandTargets()
      : Promise.resolve([]),
    tab === 'runs' && process.env.APP_ENV === 'qa' ? loadAgentJobs(20) : Promise.resolve([]),
  ]);

  const launcherBrands = [
    ...new Set(
      brandTargets
        .filter(({ target }) => target.enabled)
        .map(({ target }) => canonicalVehicleBrand(target.brand)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const pageLink = (p: number) =>
    '/admin/agents?' +
    new URLSearchParams({
      tab,
      review,
      ...(agentType ? { agent: agentType } : {}),
      page: String(p),
    }).toString();

  const tabs: readonly [AgentTab, string][] = [
    ['overview', 'Visão geral'],
    ['review', 'Revisão'],
    ['runs', 'Execuções'],
    ['controls', 'Controles'],
  ];

  return (
    <>
      <PageHeader
        title="Agentes"
        description="Controle operacional, ingestão, evidências e decisões humanas."
      />

      <div className="mt-5 space-y-5">
        <nav aria-label="Control Center dos agentes" className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={key === 'overview' ? '/admin/agents' : '/admin/agents?tab=' + key}
              aria-current={tab === key ? 'page' : undefined}
              className="ui-button ui-button--secondary ui-button--action"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/admin/agents/brands"
            className="ui-button ui-button--secondary ui-button--action"
          >
            Marcas
          </Link>
        </nav>

        {tab === 'overview' ? <AgentControlCenterOverview summary={controlCenter} /> : null}

        {tab === 'controls' ? (
          process.env.APP_ENV === 'qa' ? (
            <AgentRunLauncher brands={launcherBrands} />
          ) : (
            <p className="text-sm text-text-muted">
              Controles de execução estão disponíveis apenas no ambiente QA.
            </p>
          )
        ) : null}

        {tab === 'runs' ? (
          <div className="space-y-5">
            {process.env.APP_ENV === 'qa' ? <AgentJobQueue items={jobs} /> : null}
            <AgentRunHistory
              items={(result as Awaited<ReturnType<typeof loadAgentRuns>>).items}
            />
          </div>
        ) : null}

        {tab === 'review' ? (
          <div className="space-y-5">
            <form className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tab" value="review" />
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

            <AgentFindingTable
              items={(result as Awaited<ReturnType<typeof loadAgentQueue>>).items}
            />

            <nav aria-label="Paginação" className="flex items-center gap-4 text-sm">
              {page > 1 ? <Link href={pageLink(page - 1)}>Anterior</Link> : null}
              <span>
                Página {page} · {result.total} registros
              </span>
              {page * 25 < result.total ? <Link href={pageLink(page + 1)}>Próxima</Link> : null}
            </nav>
          </div>
        ) : null}
      </div>
    </>
  );
}
