import Link from 'next/link';
import { requireRole } from '@/auth/authorization';
import { CommercialPolicyWorkspace } from '@/components/admin/commercial-policy-workspace';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
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
      <CatalogPageHeading title="Cadastrar Políticas" description="Gerencie políticas e combinações comerciais por veículo." />
      <div className="flex items-center py-3">
        <Link href="/admin/prices" className="cc-outline-icon-action">
          <img src="/carboot/back.svg" alt="" aria-hidden="true" className="size-4" />
          Voltar aos preços
        </Link>
      </div>
      <section className="mt-0">
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
