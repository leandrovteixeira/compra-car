import {
  parseAdminPriceFilters,
  parseAdminPriceSort,
  type AdminPriceQuery,
} from '@/application/admin/admin-price-query';
import { requireRole } from '@/auth/authorization';
import { AdminPriceError } from '@/components/admin/admin-price-error';
import { AdminPriceFilters } from '@/components/admin/admin-price-filters';
import { AdminPriceManager } from '@/components/admin/admin-price-manager';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { loadAllAdminProductPublicPrices } from '@/server/admin-product-public-price-service';
import { loadAdminProducts } from '@/server/admin-product-service';
import { withDevTiming } from '@/server/dev-timing';
import { createProductPublicPriceAction, publishProductPublicPriceAction, updateProductPublicPriceAction } from './actions';

interface AdminPricesPageProps {
  readonly searchParams: Promise<AdminPriceQuery>;
}

export default async function AdminPricesPage({ searchParams }: AdminPricesPageProps) {
  await requireRole('admin');
  const params = await searchParams;
  const sorting = parseAdminPriceSort(params);
  const filters = parseAdminPriceFilters(params);
  const [result, productsResult] = await withDevTiming('pricing.page.list', () =>
    Promise.all([
      withDevTiming('pricing.listBasePrices', () =>
        loadAllAdminProductPublicPrices({
          ...sorting,
          sort: sorting.sort === 'endsOn' ? 'startsOn' : sorting.sort,
          search: filters.search || undefined,
          status: filters.status === 'all' ? undefined : filters.status,
        }, sorting.sort === 'endsOn' ? 'endsOn' : undefined),
      ),
      withDevTiming('pricing.listProductOptions', () => loadAdminProducts()),
    ]),
  );

  return (
    <section
      className="admin-pricing-workspace"
      style={{ gridTemplateRows: 'auto auto minmax(0, 1fr)' }}
    >
      <div className="admin-pricing-page-header">
        <CatalogPageHeading title="Lista de Preços" description="Consulte, revise e publique preços públicos dos veículos." />
      </div>
      <div className="admin-pricing-toolbar">
        <AdminPriceFilters values={filters} />
      </div>
      <div className="admin-pricing-results mt-5 lg:mt-0">
        {!result.ok || !productsResult.ok ? (
          <AdminPriceError />
        ) : (
          <AdminPriceManager
            page={result.data}
            products={productsResult.data.map((product) => ({
              id: product.id,
              label: `${product.brand} ${product.model} ${product.version} ${product.modelYear}`,
            }))}
            updateAction={updateProductPublicPriceAction}
            createAction={createProductPublicPriceAction}
            publishAction={publishProductPublicPriceAction}
          />
        )}
      </div>
    </section>
  );
}
