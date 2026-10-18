
import { requireRole } from '@/auth/authorization';
import { AdminPriceBatchGrid } from '@/components/admin/admin-price-batch-grid';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { loadManualPriceBatchProductOptions } from '@/server/manual-price-batch-service';
import { withDevTiming } from '@/server/dev-timing';

import { createManualPriceBatchAction } from './actions';

export default async function AdminPriceInputPage() {
  await requireRole('admin');
  const products = await withDevTiming('pricing.page.input', loadManualPriceBatchProductOptions);

  return (
    <>
      <CatalogPageHeading title="Cadastrar Preços" description="Informe até 100 preços de uma vez; os preços manuais são publicados após a validação do lote." />
      <section className="mt-0" aria-label="Lote manual de preços públicos">
        {!products.ok ? (
          <div
            className="rounded-lg border border-status-error/40 bg-rose-950/10 px-5 py-8 text-center"
            role="alert"
          >
            <h2 className="text-lg font-semibold text-rose-200">
              Não foi possível carregar os veículos
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
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
