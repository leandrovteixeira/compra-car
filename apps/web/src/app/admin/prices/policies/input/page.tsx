import Link from 'next/link';
import { requireRole } from '@/auth/authorization';
import { CommercialPolicyWorkspace } from '@/components/admin/commercial-policy-workspace';
import { PageHeader } from '@/components/admin/page-header';
import { loadManualPolicyBatchOptions } from '@/server/manual-policy-batch-service';
import { withDevTiming } from '@/server/dev-timing';
import {
  archiveWorkspaceOffer,
  archiveWorkspacePolicy,
  createManualPolicyBatchAction,
  replaceWorkspaceOffer,
  updateWorkspacePolicy,
} from './actions';
import { loadCommercialOfferBuilder } from '@/server/commercial-offer-builder-service';
import { createCommercialOfferDraftAction } from '../../offers/actions';
export default async function AdminPolicyInputPage() {
  await requireRole('admin');
  const [options, offers] = await Promise.all([
    withDevTiming('pricing.page.policies', loadManualPolicyBatchOptions),
    withDevTiming('pricing.page.policy-workspace', loadCommercialOfferBuilder),
  ]);
  return (
    <>
      <PageHeader
        sticky
        eyebrow="Pricing"
        title="Criar políticas"
        description="Workspace comercial unificado por veículo para políticas e combinações."
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200"
            href="/admin/prices"
          >
            Voltar para preços
          </Link>
        }
      />
      <section className="mt-8">
        <CommercialPolicyWorkspace
          policyAction={createManualPolicyBatchAction}
          offerAction={createCommercialOfferDraftAction}
          updatePolicyAction={updateWorkspacePolicy}
          archivePolicyAction={archiveWorkspacePolicy}
          replaceOfferAction={replaceWorkspaceOffer}
          archiveOfferAction={archiveWorkspaceOffer}
          {...options}
          policies={offers.policies}
          drafts={offers.drafts}
        />
      </section>
    </>
  );
}
