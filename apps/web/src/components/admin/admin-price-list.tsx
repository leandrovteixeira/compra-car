'use client';

import type { ProductPublicPriceListPageDto, PricingWorkflowStatus } from '@compra-car/contracts';
import { isProductPublicPriceEditable } from '@compra-car/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buttonClassName, tableClassName, tableFrameClassName } from '@compra-car/ui';

import {
  adminPriceVisualStatusLabel,
  formatAdminDate,
  formatAdminPrice,
  isAdminPriceExpired,
  operationalDateInSaoPaulo,
} from './admin-price-presentation';

interface AdminPriceListProps {
  readonly page: ProductPublicPriceListPageDto;
  readonly onEdit: (id: string, opener: HTMLButtonElement) => void;
  readonly onCorrect: (id: string, opener: HTMLButtonElement) => void;
  readonly publishAction: (
    formData: FormData,
  ) => Promise<{ readonly ok: boolean; readonly message: string }>;
  readonly onPublished: (message: string) => void;
}

function statusClass(status: PricingWorkflowStatus, expired: boolean): string {
  if (expired) return 'border-slate-600 bg-slate-800/70 text-slate-200';
  return status === 'published'
    ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
    : status === 'needs_review'
      ? 'border-amber-800 bg-amber-950/50 text-amber-300'
      : 'border-slate-700 bg-slate-900 text-slate-300';
}

function hrefWithParams(currentParams: URLSearchParams, changes: Readonly<Record<string, string | null>>): string {
  const params = new URLSearchParams(currentParams.toString());
  for (const [name, value] of Object.entries(changes)) {
    if (value === null || value === '') params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return query ? `/admin/prices?${query}` : '/admin/prices';
}

function SortHeader({
  page,
  field,
  children,
}: {
  readonly page: ProductPublicPriceListPageDto;
  readonly field: ProductPublicPriceListPageDto['sort'];
  readonly children: React.ReactNode;
}) {
  const currentParams = useSearchParams();
  const active = page.sort === field;
  const direction = active && page.direction === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className="font-semibold bg-[#DCE8ED]"
      scope="col"
      aria-sort={active ? (page.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        className="inline-flex items-center gap-1 rounded hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus"
        href={hrefWithParams(currentParams, {
          page: null,
          sort: field,
          direction,
        })}
      >
        {children}
        <span aria-hidden="true">{active ? (page.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </Link>
    </th>
  );
}

export function AdminPriceList({ page, onEdit, onCorrect, publishAction, onPublished }: AdminPriceListProps) {
  const operationalDate = operationalDateInSaoPaulo();
  const currentParams = useSearchParams();
  return (
    <div className={`${tableFrameClassName} admin-pricing-table-frame`}>
      <div className="admin-pricing-table-scroll overflow-auto">
        <table className={`${tableClassName} min-w-[56rem]`}>
          <caption className="sr-only">Preços públicos cadastrados</caption>
          <thead className="admin-pricing-table-header bg-[#DCE8ED]">
            <tr>
              <SortHeader page={page} field="vehicle">
                Veículo
              </SortHeader>
              <SortHeader page={page} field="amount">
                Preço público
              </SortHeader>
              <SortHeader page={page} field="startsOn">
                Vigência De
              </SortHeader>
              <th scope="col" className="bg-[#DCE8ED] font-semibold">Vigência Até</th>
              <SortHeader page={page} field="status">
                Status
              </SortHeader>
              <SortHeader page={page} field="updatedAt">
                Atualizado em
              </SortHeader>
              <th className="bg-[#DCE8ED] text-center font-semibold" scope="col">Editar</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((price) => (
              <tr className="group align-middle transition-colors hover:!bg-[#EAF1F4]" key={price.id}>
                <td className="whitespace-nowrap">
                  <span className="cc-type-data font-semibold text-[#1A1D21]">{price.product.brand} {price.product.model} {price.product.version} {price.product.modelYear}</span>
                </td>
                <td className="whitespace-nowrap font-semibold text-text-primary">
                  <p>{formatAdminPrice(price.money.amount, price.money.currencyCode)}</p>
                </td>
                <td className="whitespace-nowrap text-text-secondary">
                  <p>{formatAdminDate(price.startsOn)}</p>

                </td>
                <td className="whitespace-nowrap text-text-secondary">{price.endsOn ? formatAdminDate(price.endsOn) : "—"}</td>
                <td>
                  <span
                    className="inline-flex items-center justify-center"
                  >
                    {(() => {
                      const label = adminPriceVisualStatusLabel(price.status, price.startsOn, price.endsOn, operationalDate);
                      const icon = label === 'Vigente' ? 'vigente' : label === 'Expirado' ? 'expired' : label === 'Rascunho' ? 'draft' : null;
                      return icon ? <img src={`/carboot/status_${icon}.svg`} alt={label} className="h-5 w-auto max-w-28 object-contain" /> : label;
                    })()}
                  </span>
                </td>
                <td className="whitespace-nowrap text-text-secondary">
                  <p>{formatAdminDate(price.updatedAt)}</p>
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {isProductPublicPriceEditable(price.status) ? (
                      <button
                        className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action group-hover:!bg-[#1A1D21] group-hover:!text-white"
                        onClick={(event) => onEdit(price.id, event.currentTarget)}
                        type="button"
                      >
                        Editar
                      </button>
                    ) : (
                      <button type="button" title="Criar rascunho de correção sem modificar o preço publicado" onClick={event => onCorrect(price.id, event.currentTarget)} className="cc-btn cc-btn--p cc-btn--secondary admin-catalog-action group-hover:!bg-[#1A1D21] group-hover:!text-white">Corrigir</button>
                    )}
                    {price.status === 'draft' || price.status === 'needs_review' ? (
                      <form
                        action={async (data) => {
                          if (
                            !window.confirm(
                              'Publicar preço? Este preço passará a ser utilizado pelas regras comerciais aplicáveis.',
                            )
                          )
                            return;
                          const result = await publishAction(data);
                          onPublished(result.message);
                        }}
                      >
                        <input type="hidden" name="id" value={price.id} />
                        <input type="hidden" name="lockVersion" value={price.lockVersion} />
                        <button
                          className={buttonClassName({ size: 'commit', variant: 'interactive' })}
                          type="submit"
                        >
                          Publicar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-3 py-2 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          {page.total} {page.total === 1 ? 'preço encontrado' : 'preços encontrados'}
        </p>
        {page.pageCount > 1 ? (
          <nav aria-label="Paginação de preços públicos" className="flex items-center gap-2">
            {page.page > 1 ? (
              <Link
                className={buttonClassName({ size: 'action', variant: 'secondary' })}
                href={hrefWithParams(currentParams, { page: String(page.page - 1) })}
              >
                Anterior
              </Link>
            ) : null}
            <span>
              Página {page.page} de {page.pageCount}
            </span>
            {page.page < page.pageCount ? (
              <Link
                className={buttonClassName({ size: 'action', variant: 'secondary' })}
                href={hrefWithParams(currentParams, { page: String(page.page + 1) })}
              >
                Próxima
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
