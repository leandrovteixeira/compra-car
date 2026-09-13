import { notFound } from 'next/navigation';
import { loadAgentRun } from '@/application/admin/agent-platform';
import { AgentRunDetail } from '@/components/admin/agent-platform-views';
import { PageHeader } from '@/components/admin/page-header';
export default async function AgentRunPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await loadAgentRun(id);
  if (!bundle) notFound();
  return (
    <>
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
