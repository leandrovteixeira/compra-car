import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadAgentRun } from '@/application/admin/agent-platform';
import { AgentRunDetail } from '@/components/admin/agent-platform-views';
import { PageHeader } from '@/components/admin/page-header';
export default async function AgentRunPage({
  params, searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = typeof query.returnTo === 'string' &&
    (query.returnTo === '/admin/agents' || query.returnTo.startsWith('/admin/agents?'))
    ? query.returnTo : '/admin/agents';
  const bundle = await loadAgentRun(id);
  if (!bundle) notFound();
  return (
    <>
      <div className="mb-3">
        <Link href={returnTo} className="inline-flex items-center gap-2 text-sm font-semibold text-[#A9541B] hover:underline">
          <span aria-hidden="true">←</span> Voltar às Revisões
        </Link>
      </div>
      <PageHeader
        title="Detalhes da run"
        description={bundle.run.agentType + ' · ' + bundle.run.status}
      />
      <div className="mt-5">
        <AgentRunDetail bundle={bundle} />
      </div>
    </>
  );
}
