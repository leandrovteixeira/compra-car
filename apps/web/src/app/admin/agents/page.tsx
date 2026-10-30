import Link from 'next/link';
import { REVIEW_STATUSES, type ReviewStatus } from '@compra-car/core/agent-platform';
import { canonicalVehicleBrand } from '@compra-car/core/agents';
import { loadAgentRuns } from '@/application/admin/agent-platform';
import { loadAgentJobs } from '@/application/admin/agent-runner';
import { loadBrandTargets } from '@/application/admin/brand-connectors';
import { loadAgentControlCenterSummary } from '@/application/admin/agent-control-center';
import { loadAgentHandoffSummary } from '@/application/admin/agent-handoff-summary';
import { AgentHandoffPanel } from '@/components/admin/agent-handoff-panel';
import { loadReviewInbox, type ReviewSort, type ReviewDirection } from '@/application/admin/agent-review-inbox';
import { AgentReviewFilters, type AgentFilter } from '@/components/admin/agent-review-filters';
import { AgentRunHistory } from '@/components/admin/agent-platform-views';
import { AgentControlCenterOverview } from '@/components/admin/agent-control-center-overview';
import { AgentReviewInbox } from '@/components/admin/agent-review-inbox';
import { loadFipeReviewItems } from '@/application/admin/fipe-review-inbox';
import { FipeReviewQueue } from '@/components/admin/fipe-review-queue';
import { AgentRunLauncher } from '@/components/admin/agent-run-launcher';
import { AgentJobQueue } from '@/components/admin/agent-job-queue';
import { PageHeader } from '@/components/admin/page-header';

export default async function AgentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params=await searchParams;
  const flight=['flight','runs','controls','overview'].includes(String(params.tab??''));
  const status=typeof params.status==='string' &&
    (params.status==='ALL' || REVIEW_STATUSES.includes(params.status as ReviewStatus))
      ? params.status as ReviewStatus|'ALL' : 'WAITING';
  const agent:AgentFilter =
    params.agent === 'MODEL_YEAR' || params.agent === 'PRODUCT_YEAR'
      ? 'YEAR'
      : typeof params.agent==='string' &&
        ['BRAND_CONNECTOR','MMV_DISCOVERY','YEAR','SPEC_INTELLIGENCE','PRICE_INTELLIGENCE']
          .includes(params.agent) ? params.agent as AgentFilter : '';
  const sort:ReviewSort=typeof params.sort==='string' &&
    ['date','confidence','brand','model','agent'].includes(params.sort)
      ? params.sort as ReviewSort : 'date';
  const direction:ReviewDirection=params.direction==='asc'?'asc':'desc';
  const search=typeof params.q==='string'?params.q.slice(0,120):'';
  const requestedPage=typeof params.page==='string'?Number(params.page):1;
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1;

  const [inbox, summary, brandTargets, jobs, runs, handoffs, fipeItems] = await Promise.all([
    !flight ? loadReviewInbox({page,limit:25,status,agent,search,sort,direction}) : Promise.resolve(null),
    flight ? loadAgentControlCenterSummary() : Promise.resolve(null),
    flight && process.env.APP_ENV==='qa' ? loadBrandTargets() : Promise.resolve([]),
    flight && process.env.APP_ENV==='qa' ? loadAgentJobs(20) : Promise.resolve([]),
    flight ? loadAgentRuns({limit:20,offset:0,agentType:agent&&agent!=='YEAR'?agent:undefined}) : Promise.resolve(null),
    flight ? loadAgentHandoffSummary() : Promise.resolve(null),
    !flight && (agent==='' || agent==='MMV_DISCOVERY') && (status==='WAITING'||status==='ALL')
      ? loadFipeReviewItems() : Promise.resolve([]),
  ]);
  const launcherBrands=[...new Set(brandTargets
    .filter(({target})=>target.enabled).map(({target})=>canonicalVehicleBrand(target.brand)))]
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));

  const pageLink=(p:number)=>'/admin/agents?'+new URLSearchParams({
    status,...(agent?{agent}:{}),...(search?{q:search}:{}),sort,direction,page:String(p),
  }).toString();

  return (
    <>
      <PageHeader
        title={flight ? 'Flight Control' : 'Revisões'}
        description={flight
          ? 'Execuções, custos, agendamentos e saúde operacional dos agentes.'
          : 'Descobertas para decisão dos operadores.'}
        compact
      />
      <div className="mt-4 space-y-4" data-agent-workspace>
        {!flight && inbox ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-secondary">
                Descobertas consolidadas para decisão. Evidências e histórico no detalhe.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-[#FFF1E7] px-3 py-2 text-[#B85C1B]">
                  {inbox.statusCounts.WAITING} aguardando
                </span>
                <span className="rounded-md bg-[#F0F3F5] px-3 py-2 text-[#526670]">
                  {inbox.statusCounts.POSTPONED} adiados
                </span>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              QA · Aprovar aplica decisões elegíveis automaticamente. Correspondências FIPE são revisadas individualmente.
              {inbox.diagnostics.yearToMmvIdentities} pendências de identidade identificadas pelo Ano-modelo.
            </p>
            <AgentReviewFilters
              initialSearch={search}
              agent={agent}
              status={status}
              sort={sort}
              direction={direction}
            />
            <FipeReviewQueue items={fipeItems}/>
            <AgentReviewInbox items={inbox.items} sort={sort} direction={direction}/>
            <nav aria-label="Paginação de revisões" className="flex flex-wrap items-center justify-end gap-4 text-xs text-text-secondary">
              {page>1?<Link className="underline" href={pageLink(page-1)}>‹ Anterior</Link>:null}
              <span>Página {page} · {inbox.total} descobertas</span>
              {page*25<inbox.total?<Link className="underline" href={pageLink(page+1)}>Próxima ›</Link>:null}
            </nav>
          </>
        ):null}

        {flight && summary?(
          <div className="space-y-6">
            <AgentControlCenterOverview summary={summary}/>
            {handoffs ? <AgentHandoffPanel summary={handoffs} /> : null}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Custos e limites</h2>
              <div className="ui-surface p-4 text-sm text-text-secondary">
                A consolidação dos custos por agente e do orçamento mensal ainda depende do
                ledger de utilização. Nenhum valor estimado será apresentado como gasto real.
              </div>
            </section>
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Jobs e execuções recentes</h2>
              {process.env.APP_ENV==='qa'?<AgentJobQueue items={jobs}/>:null}
              {runs?<AgentRunHistory items={runs.items}/>:null}
              <Link className="text-xs font-semibold text-[#A9541B] underline"
                href="/admin/agents/flight-control">Atualizar execuções</Link>
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Controles e fontes</h2>
                <Link href="/admin/agents/brands" className="ui-button ui-button--secondary ui-button--action">
                  Administrar marcas
                </Link>
              </div>
              {process.env.APP_ENV==='qa'
                ?<AgentRunLauncher brands={launcherBrands}/>
                :<p className="text-sm text-text-muted">Controles de execução disponíveis apenas no QA.</p>}
            </section>
          </div>
        ):null}
      </div>
    </>
  );
}
