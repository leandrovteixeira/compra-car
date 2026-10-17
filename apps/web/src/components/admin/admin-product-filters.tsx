'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import type { AdminProductFilterValues } from '@/application/admin/admin-product-filters';

interface AdminProductFiltersProps {
  readonly values: AdminProductFilterValues;
}

const controlClass =
  'ui-field !h-10 !min-h-10 text-[0.8125rem] focus:border-selection-strong focus:ring-selection-strong/25';

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
      className="bg-transparent py-3"
    >
      <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1fr)_8rem_8rem_3rem_auto]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <img src="/carboot/search.svg" alt="" aria-hidden="true" className="pointer-events-none absolute left-3 bottom-[11px] size-[18px] object-contain"/>
          <span aria-hidden="true" className="mb-1 block text-xs font-semibold invisible">Buscar</span><span className="sr-only">Buscar marca, modelo ou versão</span>
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
          className="mx-auto flex size-10 items-center justify-center rounded-md hover:bg-[#EAF1F4] focus-visible:outline-2 focus-visible:outline-[#9ABCC8]" aria-label="Limpar filtros" title="Limpar filtros"
          onClick={() => {
            setSearch('');
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          type="button"
        >
          <img src="/carboot/close.svg" alt="" aria-hidden="true" className="size-4 object-contain"/>
        </button>
        <Link href="/admin/products/new" className="cc-btn cc-btn--m cc-btn--primary !min-w-[112px]">Novo veículo</Link>
      </div>
      <p aria-live="polite" className="mt-1 min-h-4 text-xs text-text-muted">
        {pending ? 'Atualizando resultados…' : ''}
      </p>
    </section>
  );
}
