'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import type { AdminPriceFilterValues } from '@/application/admin/admin-price-query';

interface AdminPriceFiltersProps {
  readonly values: AdminPriceFilterValues;
}

const controlClass =
  'ui-field min-h-9 text-[0.8125rem] focus:border-selection-strong focus:ring-selection-strong/25';

export function AdminPriceFilters({ values }: AdminPriceFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentParams = useSearchParams();
  const [search, setSearch] = useState(values.search);
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (changes: Readonly<Record<string, string>>) => {
      const params = new URLSearchParams(currentParams.toString());
      params.delete('page');
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
    <section aria-label="Filtros de preços públicos" className="border-b border-border bg-canvas pb-3 pt-3">
      <div className="grid items-end gap-2 sm:grid-cols-[minmax(20rem,1fr)_10rem_auto]">
        <label>
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
          Status
          <select
            className={`${controlClass} mt-1`}
            name="status"
            onChange={(event) => navigate({ status: event.target.value })}
            value={values.status}
          >
            <option value="current">Vigente</option>
            <option value="expired">Expirado</option>
            <option value="published">Publicado (todos)</option>
            <option value="draft">Rascunho</option>
            <option value="needs_review">Requer revisão</option>
            <option value="rejected">Rejeitado</option>
            <option value="archived">Arquivado</option>
            <option value="all">Todos</option>
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
