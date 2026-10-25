'use client';

import Link from 'next/link';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import type { AdminPriceFilterValues } from '@/application/admin/admin-price-query';
import { ComparisonLoadingOverlay } from '@/components/admin/comparison-loading-overlay';

interface AdminPriceFiltersProps {
  readonly values: AdminPriceFilterValues;
}

const controlClass =
  'ui-field !h-10 !min-h-10 text-[0.8125rem] focus:border-selection-strong focus:ring-selection-strong/25';

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
    <section aria-label="Filtros de preços públicos" className="bg-transparent py-3">
      {pending && <ComparisonLoadingOverlay />}
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-end gap-2 lg:grid-cols-[minmax(15rem,1fr)_10rem_3rem_auto_auto]">
        <label className="relative col-span-2 lg:col-span-1">
          <img
            src="/carboot/search.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[11px] left-3 size-[18px] object-contain"
          />
          <span aria-hidden="true" className="sr-only">
            Buscar
          </span>
          <span className="sr-only">Buscar marca, modelo ou versão</span>
          <input
            autoComplete="off"
            className={`${controlClass} !pl-10`}
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
          className="mx-auto flex size-10 items-center justify-center rounded-md hover:bg-[#EAF1F4]"
          aria-label="Limpar filtros"
          title="Limpar filtros"
          onClick={() => {
            setSearch('');
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          type="button"
        >
          <img
            src="/carboot/close.svg"
            alt=""
            className="size-4 object-contain"
            aria-hidden="true"
          />
        </button>
        <Link
          href="/admin/prices/input"
          className="cc-btn cc-btn--m cc-btn--primary col-span-2 lg:col-span-1"
        >
          Cadastrar preços
        </Link>
        <Link
          href="/admin/prices/policies/input"
          className="cc-btn cc-btn--m cc-btn--secondary col-span-2 lg:col-span-1"
        >
          Cadastrar políticas
        </Link>
      </div>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs text-text-muted">
        {pending ? 'Atualizando resultados…' : ''}
      </p>
    </section>
  );
}
