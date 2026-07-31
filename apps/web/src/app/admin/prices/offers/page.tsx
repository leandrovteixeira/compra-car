import Link from 'next/link';
import { requireRole } from '@/auth/authorization';
import { CommercialOfferBuilder } from '@/components/admin/commercial-offer-builder';
import { PageHeader } from '@/components/admin/page-header';
import { loadCommercialOfferBuilder } from '@/server/commercial-offer-builder-service';
import { withDevTiming } from '@/server/dev-timing';
import { createCommercialOfferDraftAction } from './actions';
export default async function CommercialOffersPage() {
  await requireRole('admin');
  const data = await withDevTiming('pricing.page.offers', loadCommercialOfferBuilder);
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Combinação de políticas"
        description="Monte até 100 combinações por veículo. Preço e vigência são resolvidos automaticamente."
        actions={
          <Link
            href="/admin/prices"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200"
          >
            Voltar para preços
          </Link>
        }
      />
      <section className="mt-8">
        <CommercialOfferBuilder action={createCommercialOfferDraftAction} {...data} />
      </section>
    </>
  );
}
