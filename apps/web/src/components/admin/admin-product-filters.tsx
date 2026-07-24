import Link from 'next/link';

import type { AdminProductFilterValues } from '@/application/admin/admin-product-filters';

interface AdminProductFiltersProps {
  readonly values: AdminProductFilterValues;
}

const controlClass =
  'mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';

export function AdminProductFilters({ values }: AdminProductFiltersProps) {
  return (
    <form
      action="/admin/products"
      className="border-b border-slate-800 bg-slate-950 pb-4 pt-4"
      method="get"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm font-semibold text-slate-300">
          Marca
          <input className={controlClass} defaultValue={values.brand} name="brand" />
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Modelo
          <input className={controlClass} defaultValue={values.vehicle} name="vehicle" />
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Versão
          <input className={controlClass} defaultValue={values.version} name="version" />
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Ativo
          <select className={controlClass} defaultValue={values.active} name="active">
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-300">
          Público
          <select className={controlClass} defaultValue={values.public} name="public">
            <option value="">Todos</option>
            <option value="true">Públicos</option>
            <option value="false">Privados</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            className="min-h-11 flex-1 rounded-xl bg-slate-200 px-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
            type="submit"
          >
            Filtrar
          </button>
          <Link
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-700 px-3 text-center text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
            href="/admin/products"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}
