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
import {
  monthlyPricingPeriod,
  normalizeMonthlyCompetence,
} from '@/application/admin/monthly-pricing-context';
import { resolveCommercialPeriod } from '@compra-car/core';
import { createProductPublicPriceAction, publishProductPublicPriceAction } from '../../actions';

interface AdminPolicyInputPageProps {
  readonly searchParams: Promise<{
    readonly competence?: string;
    readonly product?: string;
    readonly periodStart?: string;
    readonly periodEnd?: string;
  }>;
}

export default async function AdminPolicyInputPage({ searchParams }: AdminPolicyInputPageProps) {
  await requireRole('admin');
  const query = await searchParams;
  const competence = normalizeMonthlyCompetence(query.competence);
  const monthlyPeriod = monthlyPricingPeriod(competence);
  const specialResolution = resolveCommercialPeriod({
    competence,
    kind: 'special',
    specialStart: query.periodStart,
    specialEnd: query.periodEnd,
  });
  const commercialPeriod =
    query.periodStart && query.periodEnd && specialResolution.ok
      ? specialResolution.period
      : {
          competence,
          kind: 'monthly' as const,
          start: monthlyPeriod.firstDay,
          end: monthlyPeriod.lastDay,
        };
  const productId = /^\d+$/u.test(query.product ?? '') ? query.product! : '';
  const [options, offers] = await Promise.all([
    withDevTiming('pricing.page.policies', loadManualPolicyBatchOptions),
    withDevTiming('pricing.page.policy-workspace', () =>
      loadCommercialOfferBuilder({ productId: productId || '0', ...monthlyPeriod }),
    ),
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
          key={`${competence}:${commercialPeriod.kind}:${commercialPeriod.start}:${commercialPeriod.end}`}
          policyAction={createManualPolicyBatchAction}
          priceAction={createProductPublicPriceAction}
          publishPriceAction={publishProductPublicPriceAction}
          offerAction={createCommercialOfferDraftAction}
          updatePolicyAction={updateWorkspacePolicy}
          archivePolicyAction={archiveWorkspacePolicy}
          replaceOfferAction={replaceWorkspaceOffer}
          archiveOfferAction={archiveWorkspaceOffer}
          {...options}
          policies={offers.policies}
          drafts={offers.drafts}
          initialProductId={productId}
          competence={competence}
          periodFirstDay={monthlyPeriod.firstDay}
          periodLastDay={monthlyPeriod.lastDay}
          competenceLabel={monthlyPeriod.label}
          commercialPeriod={commercialPeriod}
        />
      </section>
    </>
  );
}
