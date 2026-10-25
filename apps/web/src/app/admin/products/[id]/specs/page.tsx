import { notFound } from 'next/navigation';

import { saveAdminProductSpecsAction } from './actions';

import { CarbootBackLink } from '@/components/carboot-back-link';
import { requireRole } from '@/auth/authorization';
import { AdminProductSpecsEditor } from '@/components/admin/admin-product-specs-editor';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
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
      <CatalogPageHeading title="Especificações" description="Gestão de especificações e equipamentos" />
      <div className="py-3"><CarbootBackLink href="/admin/products" label="Voltar aos modelos" className="cc-outline-icon-action" /></div>
      <div className="mt-0">
        <AdminProductSpecsEditor
          initialModel={model}
          saveAction={saveAdminProductSpecsAction.bind(null, id)}
        />
      </div>
    </>
  );
}
