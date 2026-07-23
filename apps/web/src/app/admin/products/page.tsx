import { requireRole } from '@/auth/authorization';
import { AdminProductError } from '@/components/admin/admin-product-error';
import { AdminProductList } from '@/components/admin/admin-product-list';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProducts } from '@/server/admin-product-service';

export default async function AdminProductsPage() {
  await requireRole('admin');
  const result = await loadAdminProducts();

  return (
    <>
      <PageHeader
        actions={
          <button
            className="min-h-11 cursor-not-allowed rounded-xl bg-slate-700 px-4 text-sm font-semibold text-slate-400"
            disabled
            type="button"
          >
            Novo veículo
          </button>
        }
        description="Espaço reservado para consultar e administrar o catálogo de veículos."
        eyebrow="Catálogo"
        title="Veículos"
      />

      <div className="mt-8">
        {!result.ok ? (
          <AdminProductError />
        ) : result.data.length === 0 ? (
          <EmptyState
            description="Nenhum veículo foi encontrado no catálogo. A criação continuará indisponível até a próxima etapa do MVP-a."
            title="Nenhum veículo cadastrado"
          />
        ) : (
          <AdminProductList products={result.data} />
        )}
      </div>
    </>
  );
}
