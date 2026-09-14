import { notFound } from 'next/navigation';
import { acceptedConnectorProposal } from '@compra-car/core/agents';
import { BrandConnectorForm } from '@/components/admin/brand-connector-form';
import { loadAgentFinding } from '@/application/admin/agent-platform';
import { AgentFindingDetailView } from '@/components/admin/agent-platform-views';
import { AgentReviewForm } from '@/components/admin/agent-review-form';
import { PageHeader } from '@/components/admin/page-header';
export default async function AgentFindingPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadAgentFinding(id);
  if (!detail) notFound();
  let canActivate = false;
  try {
    acceptedConnectorProposal(detail);
    canActivate = true;
  } catch {
    /* Review or proposal is not eligible. */
  }
  return (
    <>
      <PageHeader
        title={detail.finding.title}
        description="Revisão operacional com evidências. Esta decisão não altera o catálogo."
      />
      <div className="mt-5 space-y-6">
        <AgentFindingDetailView detail={detail} />
        {canActivate ? (
          <BrandConnectorForm
            operation="activate"
            label="Ativar connector"
            fields={{ findingId: id }}
          />
        ) : null}
        {detail.run.status === 'COMPLETED' ? (
          <AgentReviewForm findingId={id} />
        ) : (
          <p>A revisão fica disponível quando a run for concluída.</p>
        )}
      </div>
    </>
  );
}
