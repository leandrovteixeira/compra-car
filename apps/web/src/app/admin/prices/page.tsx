import { parseAdminPricePage, type AdminPriceQuery } from '@/application/admin/admin-price-query';
import { requireRole } from '@/auth/authorization';
import { AdminPriceError } from '@/components/admin/admin-price-error';
import { AdminPriceList } from '@/components/admin/admin-price-list';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProductPublicPrices } from '@/server/admin-product-public-price-service';

interface AdminPricesPageProps {
  readonly searchParams: Promise<AdminPriceQuery>;
}

export default async function AdminPricesPage({ searchParams }: AdminPricesPageProps) {
  await requireRole('admin');
  const page = parseAdminPricePage(await searchParams);
  const result = await loadAdminProductPublicPrices({ page });

  return (
    <>
      <PageHeader
        description="Consulte o histórico versionado de preços públicos dos veículos. Esta etapa é somente leitura."
        eyebrow="Pricing"
        title="Preços públicos"
      />
      <div className="mt-8">
        {!result.ok ? (
          <AdminPriceError />
        ) : result.data.items.length === 0 ? (
          <EmptyState
            description="Ainda não há preços públicos disponíveis para consulta nesta página."
            title="Nenhum preço público encontrado"
          />
        ) : (
          <AdminPriceList page={result.data} />
        )}
      </div>
    </>
  );
}
