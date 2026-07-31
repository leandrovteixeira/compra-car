import {
  parseAdminPricePage,
  parseAdminPriceSort,
  type AdminPriceQuery,
} from '@/application/admin/admin-price-query';
import { requireRole } from '@/auth/authorization';
import { AdminPriceError } from '@/components/admin/admin-price-error';
import { AdminPriceManager } from '@/components/admin/admin-price-manager';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProductPublicPrices } from '@/server/admin-product-public-price-service';
import { loadAdminProducts } from '@/server/admin-product-service';
import { withDevTiming } from '@/server/dev-timing';
import { publishProductPublicPriceAction, updateProductPublicPriceAction } from './actions';
import Link from 'next/link';

interface AdminPricesPageProps {
  readonly searchParams: Promise<AdminPriceQuery>;
}

export default async function AdminPricesPage({ searchParams }: AdminPricesPageProps) {
  await requireRole('admin');
  const page = parseAdminPricePage(await searchParams);
  const sorting = parseAdminPriceSort(await searchParams);
  const [result, productsResult] = await withDevTiming('pricing.page.list', () =>
    Promise.all([
      withDevTiming('pricing.listBasePrices', () =>
        loadAdminProductPublicPrices({ page, ...sorting }),
      ),
      withDevTiming('pricing.listProductOptions', () => loadAdminProducts()),
    ]),
  );

  return (
    <>
      <PageHeader
        sticky
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-sky-400"
              href="/admin/prices/input"
            >
              Criar preços
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-700 px-4 text-sm font-bold text-sky-200 transition hover:bg-sky-950"
              href="/admin/prices/policies/input"
            >
              Criar políticas
            </Link>
          </div>
        }
        description="Cadastre e edite rascunhos de preços públicos dos veículos."
        eyebrow="Pricing"
        title="Preços públicos"
      />
      <div className="mt-8">
        {!result.ok || !productsResult.ok ? (
          <AdminPriceError />
        ) : (
          <AdminPriceManager
            page={result.data}
            products={productsResult.data.map((product) => ({
              id: product.id,
              label: `${product.brand} ${product.model} ${product.version} — ${product.modelYear}`,
            }))}
            updateAction={updateProductPublicPriceAction}
            publishAction={publishProductPublicPriceAction}
          />
        )}
      </div>
    </>
  );
}
