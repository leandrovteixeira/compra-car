import { notFound } from 'next/navigation';
import {
  acceptedConnectorProposal,
  mmvApplyEligibility,
  modelYearApplyEligibility,
} from '@compra-car/core/agents';
import { BrandConnectorForm } from '@/components/admin/brand-connector-form';
import { MmvApplyForm } from '@/components/admin/mmv-apply-form';
import { ModelYearApplyForm } from '@/components/admin/model-year-apply-form';
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
  let canApplyMmv = false;
  let canApplyModelYear = false;
  try {
    acceptedConnectorProposal(detail);
    canActivate = true;
  } catch {
    /* Review or proposal is not eligible. */
  }
  canApplyMmv = mmvApplyEligibility(detail, {
    expectedFingerprint: detail.finding.fingerprint,
  }).eligible;
  canApplyModelYear = modelYearApplyEligibility(detail, {
    expectedFingerprint: detail.finding.fingerprint,
  }).eligible;
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
        {canApplyMmv ? (
          <MmvApplyForm
            findingId={id}
            expectedFingerprint={detail.finding.fingerprint}
          />
        ) : null}
        {canApplyModelYear ? (
          <ModelYearApplyForm
            findingId={id}
            expectedFingerprint={detail.finding.fingerprint}
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
