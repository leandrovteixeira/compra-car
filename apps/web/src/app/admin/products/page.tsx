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
  const result = await loadAdminProducts(parsed.filters);

  return (
    <>
      <div className="bg-slate-950 lg:sticky lg:top-[4.25rem] lg:z-30 lg:h-[15rem]">
        <PageHeader
          actions={
            <Link
              className="flex min-h-11 items-center rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              href="/admin/products/new"
            >
              Novo veículo
            </Link>
          }
          compact
          description="Consulte e administre o catálogo de veículos."
          title="Veículos"
        />
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
                  className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 font-semibold text-slate-200 hover:bg-slate-800"
                  href="/admin/products"
                >
                  Limpar filtros
                </Link>
              ) : undefined
            }
            description={
              parsed.hasFilters
                ? 'Nenhum veículo corresponde à combinação de filtros informada.'
                : 'Nenhum veículo foi encontrado no catálogo. Use “Novo veículo” para fazer o primeiro cadastro.'
            }
            title={parsed.hasFilters ? 'Nenhum resultado encontrado' : 'Nenhum veículo cadastrado'}
          />
        ) : (
          <AdminProductList products={result.data} />
        )}
      </div>
    </>
  );
}
