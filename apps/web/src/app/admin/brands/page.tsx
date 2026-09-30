import { AdminBrandCreate } from '@/components/admin/admin-brand-create';
import { AdminBrandList } from '@/components/admin/admin-brand-list';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { loadMonitoredBrands } from '@/server/brand-monitoring';

export default async function AdminBrandsPage() {
  const brands = await loadMonitoredBrands();

  return (
    <>
      <PageHeader
        actions={<AdminBrandCreate />}
        description="Marcas desta lista são monitoradas pelo Brand Connector no mercado brasileiro."
        title="Marcas monitoradas"
      />

      <div className="mt-8">
        {brands.length === 0 ? (
          <EmptyState
            description="Cadastre uma marca para iniciar o monitoramento pelo Brand Connector."
            title="Nenhuma marca monitorada"
          />
        ) : (
          <AdminBrandList brands={brands} />
        )}
      </div>
    </>
  );
}
