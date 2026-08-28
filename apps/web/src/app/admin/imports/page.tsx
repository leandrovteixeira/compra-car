import Link from 'next/link';
import { buttonClassName, fieldClassName } from '@compra-car/ui';

import { parseAdminImportQuery, type AdminImportQuery } from '@/application/admin/import-query';
import { requireRole } from '@/auth/authorization';
import { AdminImportList } from '@/components/admin/admin-import-list';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminImportBatches } from '@/server/import-engine-service';

export default async function AdminImportsPage({
  searchParams,
}: {
  readonly searchParams: Promise<AdminImportQuery>;
}) {
  await requireRole('admin');
  const query = parseAdminImportQuery(await searchParams);
  const page = await loadAdminImportBatches(query);
  return (
    <>
      <PageHeader
        actions={
          <Link
            className={buttonClassName({ size: 'action', variant: 'interactive' })}
            href="/admin/imports/new"
          >
            Nova importação
          </Link>
        }
        description="Receba, organize e audite documentos antes das futuras etapas de extração e revisão."
        eyebrow="Import Engine"
        title="Importações"
      />
      <form className="mt-5 grid gap-2 border-b border-border pb-4 sm:grid-cols-4">
        <input
          className={`${fieldClassName} sm:col-span-2`}
          defaultValue={query.text}
          name="q"
          placeholder="Buscar dossiê"
        />
        <select className={fieldClassName} defaultValue={query.status ?? ''} name="status">
          <option value="">Todos os status</option>
          <option value="uploaded">Uploaded</option>
          <option value="ready">Ready</option>
          <option value="failed">Failed</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
        <button className={buttonClassName({ size: 'action', variant: 'secondary' })} type="submit">
          Filtrar
        </button>
      </form>
      <div className="mt-4">
        <AdminImportList items={page.items} />
      </div>
    </>
  );
}
