import Link from 'next/link';

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
          <Link className="ui-button ui-button--primary" href="/admin/imports/new">
            Nova importação
          </Link>
        }
        description="Receba, organize e audite documentos antes das futuras etapas de extração e revisão."
        eyebrow="Import Engine"
        title="Importações"
      />
      <form className="mt-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:grid-cols-4">
        <input
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-white sm:col-span-2"
          defaultValue={query.text}
          name="q"
          placeholder="Buscar dossiê"
        />
        <select
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-white"
          defaultValue={query.status ?? ''}
          name="status"
        >
          <option value="">Todos os status</option>
          <option value="uploaded">Uploaded</option>
          <option value="ready">Ready</option>
          <option value="failed">Failed</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
        <button
          className="min-h-11 rounded-xl border border-sky-700 px-4 text-sm font-bold text-sky-200"
          type="submit"
        >
          Filtrar
        </button>
      </form>
      <div className="mt-6">
        <AdminImportList items={page.items} />
      </div>
    </>
  );
}
