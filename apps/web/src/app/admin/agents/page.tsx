import Link from 'next/link';
import { AGENT_TYPES, REVIEW_STATUSES, type AgentType, type ReviewStatus } from '@compra-car/core/agent-platform';
import { canonicalVehicleBrand } from '@compra-car/core/agents';
import { loadAgentRuns } from '@/application/admin/agent-platform';
import { loadAgentJobs } from '@/application/admin/agent-runner';
import { loadBrandTargets } from '@/application/admin/brand-connectors';
import { loadAgentControlCenterSummary } from '@/application/admin/agent-control-center';
import { loadReviewInbox } from '@/application/admin/agent-review-inbox';
import { AgentRunHistory } from '@/components/admin/agent-platform-views';
import { AgentControlCenterOverview } from '@/components/admin/agent-control-center-overview';
import { AgentReviewInbox } from '@/components/admin/agent-review-inbox';
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
  const agent=typeof params.agent==='string' &&
    AGENT_TYPES.includes(params.agent as AgentType) ? params.agent as AgentType : undefined;
  const search=typeof params.q==='string'?params.q.slice(0,120):'';
  const requestedPage=typeof params.page==='string'?Number(params.page):1;
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1;

  const [inbox, summary, brandTargets, jobs, runs] = await Promise.all([
    !flight ? loadReviewInbox({page,limit:25,status,agent,search}) : Promise.resolve(null),
    flight ? loadAgentControlCenterSummary() : Promise.resolve(null),
    flight && process.env.APP_ENV==='qa' ? loadBrandTargets() : Promise.resolve([]),
    flight && process.env.APP_ENV==='qa' ? loadAgentJobs(20) : Promise.resolve([]),
    flight ? loadAgentRuns({limit:20,offset:0,agentType:agent}) : Promise.resolve(null),
  ]);
  const launcherBrands=[...new Set(brandTargets
    .filter(({target})=>target.enabled).map(({target})=>canonicalVehicleBrand(target.brand)))]
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));

  const pageLink=(p:number)=>'/admin/agents?'+new URLSearchParams({
    tab:'review',status,...(agent?{agent}:{}),...(search?{q:search}:{}),page:String(p),
  }).toString();

  return (
    <>
      <PageHeader title="Agentes" description="Descobertas para decisão e controle operacional dos agentes." compact/>
      <div className="mt-4 space-y-4">
        <nav aria-label="Áreas dos agentes" className="flex flex-wrap gap-2">
          <Link href="/admin/agents" aria-current={!flight?'page':undefined}
            className={`ui-button ui-button--action ${!flight?'ui-button--primary':'ui-button--secondary'}`}>
            Fila de revisões
          </Link>
          <Link href="/admin/agents?tab=flight" aria-current={flight?'page':undefined}
            className={`ui-button ui-button--action ${flight?'ui-button--primary':'ui-button--secondary'}`}>
            Flight Control
          </Link>
        </nav>

        {!flight && inbox ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Fila de revisões</h2>
                <p className="mt-1 text-xs text-text-muted">
                  Ocorrências repetidas são agrupadas por identidade e motivo; as evidências ficam no detalhe.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-[#FFF1E7] px-3 py-2 text-[#B85C1B]">
                  {inbox.statusCounts.WAITING} aguardando
                </span>
                <span className="rounded-md bg-[#F0F3F5] px-3 py-2 text-[#526670]">
                  {inbox.statusCounts.POSTPONED} adiados
                </span>
              </div>
            </div>
            <div className="rounded-md border border-[#D6DEE3] bg-[#EDF4F6] px-3 py-2 text-xs text-[#526670]" role="note">
              Prévia operacional: revisão e evidências reais do QA. Aprovar, canonicalizar e rejeitar serão
              habilitados apenas após validação da gravação transacional. Revisões antigas ACCEPT não são
              exibidas como aprovação canônica.
            </div>
            <form action="/admin/agents" method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="review"/>
              <label className="min-w-[220px] flex-1">
                <span className="sr-only">Buscar descoberta</span>
                <input name="q" type="search" defaultValue={search} maxLength={120}
                  placeholder="Buscar marca, modelo, versão ou descoberta"
                  className="ui-field h-10 w-full"/>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                <span className="sr-only">Agente</span>
                <select className="ui-field h-10 min-w-[165px]" name="agent" defaultValue={agent??''}>
                  <option value="">Todos os agentes</option>
                  {AGENT_TYPES.map(type=><option key={type} value={type}>
                    {type==='BRAND_CONNECTOR'?'Brand Connector':
                     type==='MMV_DISCOVERY'?'MMV Discovery':
                     type==='PRODUCT_YEAR'||type==='MODEL_YEAR'?'Ano-modelo':
                     type==='SPEC_INTELLIGENCE'?'Specs':'Preço'}
                  </option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                <span className="sr-only">Status da revisão</span>
                <select className="ui-field h-10 min-w-[144px]" name="status" defaultValue={status}>
                  <option value="WAITING">Aguardando</option>
                  <option value="POSTPONED">Adiado</option>
                  <option value="REJECTED">Rejeitado</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="ALL">Todos</option>
                </select>
              </label>
              <button type="submit" className="ui-button ui-button--primary ui-button--action h-10">Filtrar</button>
              <Link href="/admin/agents" className="ui-button ui-button--secondary ui-button--action h-10">Limpar</Link>
            </form>
            <AgentReviewInbox items={inbox.items}/>
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
                href="/admin/agents?tab=runs">Atualizar execuções</Link>
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
