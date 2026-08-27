import { notFound } from 'next/navigation';

import { saveAdminProductSpecsAction } from './actions';

import { requireRole } from '@/auth/authorization';
import { AdminProductSpecsEditor } from '@/components/admin/admin-product-specs-editor';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminProductSpecs } from '@/server/admin-product-specs';
import { loadAdminProductForEditing } from '@/server/admin-product-service';

interface AdminProductSpecsPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function AdminProductSpecsPage({ params }: AdminProductSpecsPageProps) {
  await requireRole('admin');
  const { id } = await params;
  const vehicle = await loadAdminProductForEditing(id);
  if (!vehicle) notFound();
  const model = await loadAdminProductSpecs(id);
  const identity = `${vehicle.brand} ${vehicle.model} ${vehicle.version} ${vehicle.productionYear}/${vehicle.modelYear}`;

  return (
    <>
      <PageHeader description={identity} eyebrow="Catálogo" title="Especificações e equipamentos" />
      <div className="mt-8">
        <AdminProductSpecsEditor
          initialModel={model}
          saveAction={saveAdminProductSpecsAction.bind(null, id)}
        />
      </div>
    </>
  );
}
