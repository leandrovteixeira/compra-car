import { notFound } from 'next/navigation';

import { updateAdminProductAction } from './actions';

import { requireRole } from '@/auth/authorization';
import { AdminProductForm } from '@/components/admin/admin-product-form';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProductForEditing } from '@/server/admin-product-service';

interface EditAdminProductPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function EditAdminProductPage({ params }: EditAdminProductPageProps) {
  await requireRole('admin');
  const { id } = await params;
  const values = await loadAdminProductForEditing(id);
  if (!values) notFound();

  return (
    <>
      <PageHeader
        description="Atualize os dados principais do veículo."
        eyebrow="Catálogo"
        title="Editar veículo"
      />
      <div className="mt-8">
        <AdminProductForm
          action={updateAdminProductAction.bind(null, id)}
          currentYear={new Date().getFullYear()}
          initialValues={values}
          mode="edit"
        />
      </div>
    </>
  );
}
