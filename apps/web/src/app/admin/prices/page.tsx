import { parseAdminPricePage, type AdminPriceQuery } from '@/application/admin/admin-price-query';
import { requireRole } from '@/auth/authorization';
import { AdminPriceError } from '@/components/admin/admin-price-error';
import { AdminPriceManager } from '@/components/admin/admin-price-manager';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProductPublicPrices } from '@/server/admin-product-public-price-service';
import { loadAdminProducts } from '@/server/admin-product-service';
import { createProductPublicPriceAction, updateProductPublicPriceAction } from './actions';

interface AdminPricesPageProps {
  readonly searchParams: Promise<AdminPriceQuery>;
}

export default async function AdminPricesPage({ searchParams }: AdminPricesPageProps) {
  await requireRole('admin');
  const page = parseAdminPricePage(await searchParams);
  const [result, productsResult] = await Promise.all([
    loadAdminProductPublicPrices({ page }),
    loadAdminProducts(),
  ]);

  return (
    <>
      <PageHeader
        description="Cadastre e edite rascunhos de preços públicos dos veículos."
        eyebrow="Pricing"
        title="Preços públicos"
      />
      <div className="mt-8">
        {!result.ok || !productsResult.ok ? (
          <AdminPriceError />
        ) : (
          <AdminPriceManager
            createAction={createProductPublicPriceAction}
            page={result.data}
            products={productsResult.data.map((product) => ({
              id: product.id,
              label: `${product.brand} ${product.model} ${product.version} — ${product.modelYear}`,
            }))}
            updateAction={updateProductPublicPriceAction}
          />
        )}
      </div>
    </>
  );
}
