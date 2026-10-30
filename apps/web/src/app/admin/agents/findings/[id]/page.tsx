import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadAgentFinding } from '@/application/admin/agent-platform';
import { AgentFindingDetailView } from '@/components/admin/agent-platform-views';
import { PageHeader } from '@/components/admin/page-header';
export default async function AgentFindingPage({
  params,
}:{
  readonly params:Promise<{id:string}>;
}){
  const {id}=await params;
  const detail=await loadAgentFinding(id);
  if(!detail)notFound();
  return <>
    <PageHeader title={detail.finding.title}
      description="Detalhes e evidências da descoberta. As decisões definitivas ficam na fila de Revisões."/>
    <div className="mt-5 space-y-5">
      <AgentFindingDetailView detail={detail}/>
      <div className="rounded-lg border border-[#D6DEE3] bg-[#F6F7F8] p-4 text-sm text-[#526670]">
        Aprovar na fila de Revisões já aplica a descoberta elegível. Nenhum segundo clique de Aplicar é necessário.
        <div className="mt-3"><Link className="text-[#A9541B] underline underline-offset-2" href="/admin/agents">Voltar à fila de Revisões</Link></div>
      </div>
    </div>
  </>;
}
