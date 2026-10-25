'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import type { ProductPublicPriceListItemDto } from '@compra-car/contracts';
import {
  adminPriceVisualStatusLabel,
  formatAdminDate,
  formatAdminPrice,
} from './admin-price-presentation';
import { priceSortLabels, type PriceSort, type PriceSortField } from './price-list-sorting';

export function PriceSortButton({
  field,
  label,
  sort,
  onSort,
}: {
  readonly field: PriceSortField;
  readonly label: ReactNode;
  readonly sort: PriceSort | null;
  readonly onSort: (field: PriceSortField) => void;
}) {
  const active = sort?.field === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Ordenar por ${priceSortLabels[field]}: ${active ? (sort.direction === 'asc' ? 'crescente; próxima decrescente' : 'decrescente; próxima padrão') : 'padrão; próxima crescente'}`}
      className="inline-flex min-h-11 w-11 min-w-11 -mr-3.5 lg:mr-0 lg:w-auto lg:min-h-0 items-center justify-center gap-2 rounded text-left font-semibold focus-visible:outline-2 focus-visible:outline-focus"
    >
      {label}
      <Image
        src={active ? '/carboot/sort_back.svg' : '/carboot/order2.svg'}
        alt=""
        width={14}
        height={14}
        className={`shrink-0 ${active ? (sort.direction === 'desc' ? '-rotate-90' : 'rotate-90') : ''}`}
      />
    </button>
  );
}

export function PriceMobileList({
  items,
  today,
  sort,
  onSort,
  renderActions,
  renderEditor,
}: {
  readonly items: readonly ProductPublicPriceListItemDto[];
  readonly today: string;
  readonly sort: PriceSort | null;
  readonly onSort: (field: PriceSortField) => void;
  readonly renderActions?: (price: ProductPublicPriceListItemDto) => ReactNode;
  readonly renderEditor?: (price: ProductPublicPriceListItemDto) => ReactNode;
}) {
  const [field, setField] = useState<PriceSortField>(sort?.field ?? 'vehicle');
  return (
    <div className="cc-mobile-prices lg:hidden">
      <p className="mb-2 text-xs text-text-muted">Toque no veículo para ver os detalhes.</p>
      <div className="flex items-center gap-2 rounded-t-lg border border-border bg-[#DCE8ED] p-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ordenar preços por</span>
          <select
            className="ui-field !h-11 w-full"
            value={field}
            onChange={(e) => {
              const next = e.target.value as PriceSortField;
              setField(next);
              onSort(next);
            }}
          >
            {Object.entries(priceSortLabels)
              .filter(([key]) => key !== 'publishedAt')
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <PriceSortButton
          field={field}
          label={<span className="sr-only">Ordenar</span>}
          sort={sort}
          onSort={onSort}
        />
      </div>
      <div className="overflow-hidden rounded-b-lg border-x border-b border-border bg-white">
        {items.map((price) => (
          <details key={price.id} className="group border-b border-border last:border-b-0">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-3 text-[13px] font-semibold text-text-primary hover:bg-selection [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 break-words">
                {price.product.brand} {price.product.model} {price.product.version}{' '}
                {price.product.modelYear}
              </span>
              <Image
                src="/carboot/arrow.svg"
                alt=""
                width={16}
                height={16}
                className="shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-border bg-[#F8FAFB] px-3 py-4">
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-3 text-xs">
                {[
                  ['Preço público', formatAdminPrice(price.money.amount, price.money.currencyCode)],
                  ['Vigência De', formatAdminDate(price.startsOn)],
                  ['Vigência Até', price.endsOn ? formatAdminDate(price.endsOn) : 'Sem término'],
                  [
                    'Status',
                    adminPriceVisualStatusLabel(price.status, price.startsOn, price.endsOn, today),
                  ],
                  ['Atualizado em', formatAdminDate(price.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="mt-1 break-words font-semibold text-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              {renderEditor?.(price)}
              {renderActions && <div className="mt-4">{renderActions(price)}</div>}
            </div>
          </details>
        ))}
        {!items.length && <p className="p-4 text-sm text-text-muted">Nenhum preço encontrado.</p>}
      </div>
    </div>
  );
}
