import Link from 'next/link';

import { requireRole } from '@/auth/authorization';
import { AdminPriceBatchGrid } from '@/components/admin/admin-price-batch-grid';
import { PageHeader } from '@/components/admin/page-header';
import { loadManualPriceBatchProductOptions } from '@/server/manual-price-batch-service';
import { withDevTiming } from '@/server/dev-timing';

import { createManualPriceBatchAction } from './actions';

export default async function AdminPriceInputPage() {
  await requireRole('admin');
  const products = await withDevTiming('pricing.page.input', loadManualPriceBatchProductOptions);

  return (
    <>
      <PageHeader
        actions={
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-sky-600 hover:text-sky-300"
            href="/admin/prices"
          >
            Voltar para preços
          </Link>
        }
        description="Informe até 100 preços de uma vez. O lote é persistente, atômico e cria somente rascunhos para revisão posterior."
        eyebrow="Pricing"
        title="Entrada de preços em lote"
      />
      <section className="mt-8" aria-label="Lote manual de preços públicos">
        {!products.ok ? (
          <div
            className="rounded-2xl border border-rose-900/70 bg-rose-950/20 px-5 py-10 text-center"
            role="alert"
          >
            <h2 className="text-lg font-semibold text-rose-200">
              Não foi possível carregar os veículos
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Recarregue a página antes de iniciar o lote.
            </p>
          </div>
        ) : (
          <AdminPriceBatchGrid action={createManualPriceBatchAction} products={products.data} />
        )}
      </section>
    </>
  );
}
