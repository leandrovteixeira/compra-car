import { notFound } from 'next/navigation';

import { createAdminProductAction } from '@/app/admin/products/new/actions';
import { requireRole } from '@/auth/authorization';
import { AdminProductForm } from '@/components/admin/admin-product-form';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProductForEditing } from '@/server/admin-product-service';

interface DuplicateAdminProductPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function DuplicateAdminProductPage({
  params,
}: DuplicateAdminProductPageProps) {
  await requireRole('admin');
  const { id } = await params;
  const values = await loadAdminProductForEditing(id);
  if (!values) notFound();

  return (
    <>
      <PageHeader
        description="Use os dados abaixo como base. Ao confirmar, um novo cadastro será criado sem copiar equipamentos, preços ou imagens."
        eyebrow="Catálogo · Novo cadastro"
        title="Duplicar veículo"
      />
      <div className="mt-8">
        <AdminProductForm
          action={createAdminProductAction}
          currentYear={new Date().getFullYear()}
          initialValues={values}
          mode="duplicate"
        />
      </div>
    </>
  );
}
