import { requireRole } from '@/auth/authorization';
import Link from 'next/link';
import {
  parseAdminProductFilters,
  type AdminProductSearchParams,
} from '@/application/admin/admin-product-filters';
import { AdminProductError } from '@/components/admin/admin-product-error';
import { AdminProductFilters } from '@/components/admin/admin-product-filters';
import { AdminProductList } from '@/components/admin/admin-product-list';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProducts } from '@/server/admin-product-service';

interface AdminProductsPageProps {
  readonly searchParams: Promise<AdminProductSearchParams>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  await requireRole('admin');
  const parsed = parseAdminProductFilters(await searchParams);
  const result = await loadAdminProducts(parsed.filters, undefined, parsed.values.search);

  return (
    <>
      <div className="admin-catalog-page-header">
        <PageHeader
          actions={
            <Link className="ui-button ui-button--primary" href="/admin/products/new">
              Novo veículo
            </Link>
          }
          compact
          description="Consulte e administre o catálogo de veículos."
          title="Veículos"
        />
      </div>
      <div className="admin-catalog-toolbar">
        <AdminProductFilters values={parsed.values} />
      </div>

      <div className="mt-8 lg:mt-0">
        {!result.ok ? (
          <AdminProductError />
        ) : result.data.length === 0 ? (
          <EmptyState
            action={
              parsed.hasFilters ? (
                <Link
                  className="ui-button ui-button--secondary ui-button--compact"
                  href="/admin/products"
                >
                  Limpar filtros
                </Link>
              ) : undefined
            }
            description={
              parsed.hasFilters
                ? 'Ajuste a busca ou limpe os filtros para visualizar o catálogo.'
                : 'Nenhum veículo foi encontrado no catálogo. Use “Novo veículo” para fazer o primeiro cadastro.'
            }
            title={parsed.hasFilters ? 'Nenhum veículo encontrado.' : 'Nenhum veículo cadastrado'}
          />
        ) : (
          <AdminProductList products={result.data} />
        )}
      </div>
    </>
  );
}
