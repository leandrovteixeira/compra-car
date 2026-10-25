'use client';
import { useMemo, useState } from 'react';
import { PriceMobileList, PriceSortButton } from './price-mobile-list';
import {
  defaultPublicPriceSort,
  nextPriceSort,
  sortPriceRows,
  type PriceSort,
  type PriceSortField,
} from './price-list-sorting';
import type { ProductPublicPriceListPageDto } from '@compra-car/contracts';
import {
  adminPriceVisualStatusLabel,
  formatAdminDate,
  formatAdminPrice,
  operationalDateInSaoPaulo,
} from './admin-price-presentation';

export function ReadOnlyPriceList({ items }: { items: ProductPublicPriceListPageDto['items'] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('current');
  const [sort, setSort] = useState<PriceSort | null>(null);
  const onSort = (field: PriceSortField) => setSort((current) => nextPriceSort(current, field));
  const today = operationalDateInSaoPaulo();
  const rows = useMemo(() => {
    const term = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const result = items.filter((p) => {
      const name = [p.product.brand, p.product.model, p.product.version, p.product.modelYear].join(
        ' ',
      );
      const normalized = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const visual = adminPriceVisualStatusLabel(p.status, p.startsOn, p.endsOn, today);
      return (
        p.status === 'published' &&
        (!term || normalized.includes(term)) &&
        (status === 'all' ||
          (status === 'current' && visual === 'Vigente') ||
          (status === 'future' && visual === 'Previsto') ||
          (status === 'expired' && visual === 'Expirado'))
      );
    });
    return sortPriceRows(result, sort ?? defaultPublicPriceSort, today);
  }, [items, query, status, sort, today]);
  const heads: [PriceSortField, string][] = [
    ['vehicle', 'Veículo'],
    ['amount', 'Preço público'],
    ['startsOn', 'Vigência De'],
    ['endsOn', 'Vigência Até'],
    ['status', 'Status'],
    ['updatedAt', 'Atualizado em'],
  ];
  return (
    <section className="min-h-0 flex-1 flex flex-col gap-3">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] items-end gap-2 py-3 lg:flex">
        <label className="relative col-span-2 min-w-0 flex-1 lg:col-span-1">
          <img
            src="/carboot/search.svg"
            alt=""
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4"
          />
          <input
            aria-label="Buscar veículos"
            autoComplete="off"
            className="ui-field !h-10 w-full !pl-10"
            placeholder="Buscar marca, modelo ou versão..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-[#61747B]">
          Status
          <select
            aria-label="Status"
            className="ui-field mt-1 !h-10 w-full lg:w-36"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="current">Vigente</option>
            <option value="future">Previsto</option>
            <option value="expired">Expirado</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <button
          type="button"
          aria-label="Limpar filtros"
          className="grid size-10 shrink-0 place-items-center"
          onClick={() => {
            setQuery('');
            setStatus('current');
          }}
        >
          <img src="/carboot/close.svg" alt="" className="size-4" />
        </button>
      </div>
      <PriceMobileList items={rows} today={today} sort={sort} onSort={onSort} />
      <div className="hidden min-h-0 flex-1 overflow-auto lg:block rounded-lg border border-[#D6DEE3] bg-white">
        <table className="w-full min-w-[950px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#DCE8ED] uppercase text-[#61747B]">
            <tr>
              {heads.map(([key, title], i) => (
                <th
                  className={`p-3 ${i ? 'text-center' : 'text-left'}`}
                  key={key}
                  aria-sort={
                    sort?.field === key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <PriceSortButton field={key} label={title} sort={sort} onSort={onSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-[#D6DEE3] hover:bg-[#EAF1F4]">
                <td className="whitespace-nowrap p-3 font-semibold">
                  {p.product.brand} {p.product.model} {p.product.version} {p.product.modelYear}
                </td>
                <td className="p-3 text-center font-semibold">
                  {formatAdminPrice(p.money.amount, p.money.currencyCode)}
                </td>
                <td className="p-3 text-center">{formatAdminDate(p.startsOn)}</td>
                <td className="p-3 text-center">{p.endsOn ? formatAdminDate(p.endsOn) : '—'}</td>
                <td className="p-3 text-center">
                  <span className="inline-flex h-6 items-center rounded-full border border-[#AFE3C3] bg-[#F1FAF5] px-3 text-[#16854A]">
                    {adminPriceVisualStatusLabel(p.status, p.startsOn, p.endsOn, today)}
                  </span>
                </td>
                <td className="p-3 text-center">{formatAdminDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#61747B]">{rows.length} preços encontrados</p>
    </section>
  );
}
