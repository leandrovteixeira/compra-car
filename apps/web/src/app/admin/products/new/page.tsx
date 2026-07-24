import { requireRole } from '@/auth/authorization';
import { AdminProductForm } from '@/components/admin/admin-product-form';
import { PageHeader } from '@/components/admin/page-header';

export default async function NewAdminProductPage() {
  await requireRole('admin');

  return (
    <>
      <PageHeader
        description="Cadastre os dados principais do veículo. Equipamentos, preços e imagens serão tratados em etapas futuras."
        eyebrow="Catálogo"
        title="Novo veículo"
      />
      <div className="mt-8">
        <AdminProductForm currentYear={new Date().getFullYear()} />
      </div>
    </>
  );
}
