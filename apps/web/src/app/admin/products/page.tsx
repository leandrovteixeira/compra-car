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
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { loadAdminProducts } from '@/server/admin-product-service';
import { loadExistingCatalogBrands } from '@/server/admin-catalog-brands';

interface AdminProductsPageProps {
  readonly searchParams: Promise<AdminProductSearchParams>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  await requireRole('admin');
  const params = await searchParams;
  const parsed = parseAdminProductFilters(params);
  const creating = params.new === '1';
  const [result, brands] = await Promise.all([
    loadAdminProducts(parsed.filters, undefined, parsed.values.search, parsed.values.specifications),
    loadExistingCatalogBrands(),
  ]);

  return (
    <section className="admin-catalog-workspace">
      <div className="admin-catalog-page-header">
        <CatalogPageHeading title="Cadastro de Modelos" description="Consulte e administre o catálogo de veículos." />
      </div>
      <div className="admin-catalog-toolbar">
        <AdminProductFilters values={parsed.values} />
      </div>

      <div className="admin-catalog-results mt-8 lg:mt-0">
        {!result.ok ? (
          <AdminProductError />
        ) : result.data.length === 0 && !creating ? (
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
          <AdminProductList products={result.data} brands={brands} initialNew={creating} />
        )}
      </div>
    </section>
  );
}
