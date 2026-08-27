'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import type { AdminProductFilterValues } from '@/application/admin/admin-product-filters';

interface AdminProductFiltersProps {
  readonly values: AdminProductFilterValues;
}

const controlClass =
  'ui-field min-h-9 text-[0.8125rem] focus:border-selection-strong focus:ring-selection-strong/25';

export function AdminProductFilters({ values }: AdminProductFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentParams = useSearchParams();
  const [search, setSearch] = useState(values.search);
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (changes: Readonly<Record<string, string>>) => {
      const params = new URLSearchParams(currentParams.toString());
      for (const [name, value] of Object.entries(changes)) {
        if (value) params.set(name, value);
        else params.delete(name);
      }
      const query = params.toString();
      startTransition(() =>
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
      );
    },
    [currentParams, pathname, router],
  );

  useEffect(() => setSearch(values.search), [values.search]);
  useEffect(() => {
    if (search.trim() === values.search) return;
    const timer = window.setTimeout(() => navigate({ search: search.trim() }), 275);
    return () => window.clearTimeout(timer);
  }, [navigate, search, values.search]);

  return (
    <section
      aria-label="Filtros do catálogo"
      className="border-b border-border bg-canvas pb-3 pt-3"
    >
      <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(20rem,1fr)_8rem_8rem_auto]">
        <label className="sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar marca, modelo ou versão</span>
          <input
            autoComplete="off"
            className={controlClass}
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar marca, modelo ou versão..."
            type="search"
            value={search}
          />
        </label>
        <label className="text-xs font-semibold text-text-secondary">
          Ativo
          <select
            className={`${controlClass} mt-1`}
            name="active"
            onChange={(event) => navigate({ active: event.target.value })}
            value={values.active}
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-text-secondary">
          Público
          <select
            className={`${controlClass} mt-1`}
            name="public"
            onChange={(event) => navigate({ public: event.target.value })}
            value={values.public}
          >
            <option value="">Todos</option>
            <option value="true">Públicos</option>
            <option value="false">Privados</option>
          </select>
        </label>
        <button
          className="ui-button ui-button--ghost ui-button--compact"
          onClick={() => {
            setSearch('');
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          type="button"
        >
          Limpar
        </button>
      </div>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs text-text-muted">
        {pending ? 'Atualizando resultados…' : ''}
      </p>
    </section>
  );
}
