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
  if (expired) return 'border-[#D6DEE3] bg-[#F1F3F5] text-[#697786]';
  return status === 'published'
    ? 'border-[#AFE3C3] bg-[#EAF8EF] text-[#16854A]'
    : status === 'needs_review'
      ? 'border-[#EDD19A] bg-[#FFF8E8] text-[#9B6A19]'
      : 'border-[#D6DEE3] bg-[#F1F3F5] text-[#697786]';
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
      className={`font-semibold bg-[#DCE8ED] ${field === "vehicle" ? "text-left" : "text-center"}`}
      scope="col"
      aria-sort={active ? (page.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        className={`inline-flex items-center gap-1 rounded hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus ${field === "vehicle" ? "" : "justify-center"}`}
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
              <th scope="col" className="bg-[#DCE8ED] text-center font-semibold">Vigência Até</th>
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
                <td className="whitespace-nowrap text-center font-semibold text-text-primary">
                  <p>{formatAdminPrice(price.money.amount, price.money.currencyCode)}</p>
                </td>
                <td className="whitespace-nowrap text-center text-text-secondary">
                  <p>{formatAdminDate(price.startsOn)}</p>

                </td>
                <td className="whitespace-nowrap text-text-secondary">{price.endsOn ? formatAdminDate(price.endsOn) : "—"}</td>
                <td className="text-center">
                  <span
                    className={`inline-flex min-w-[6.25rem] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(price.status, isAdminPriceExpired(price.status, price.endsOn, operationalDate))}`}
                  >
                    {adminPriceVisualStatusLabel(price.status, price.startsOn, price.endsOn, operationalDate)}
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

      </div>
    </div>
  );
}
