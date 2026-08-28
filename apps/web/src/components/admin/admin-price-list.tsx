'use client';

import type { ProductPublicPriceListPageDto, PricingWorkflowStatus } from '@compra-car/contracts';
import { isProductPublicPriceEditable } from '@compra-car/core';
import Link from 'next/link';
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

function SortHeader({
  page,
  field,
  children,
}: {
  readonly page: ProductPublicPriceListPageDto;
  readonly field: ProductPublicPriceListPageDto['sort'];
  readonly children: React.ReactNode;
}) {
  const active = page.sort === field;
  const direction = active && page.direction === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className="font-semibold"
      scope="col"
      aria-sort={active ? (page.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        className="inline-flex items-center gap-1 rounded hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus"
        href={{ pathname: '/admin/prices', query: { sort: field, direction } }}
      >
        {children}
        <span aria-hidden="true">{active ? (page.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </Link>
    </th>
  );
}

export function AdminPriceList({ page, onEdit, publishAction, onPublished }: AdminPriceListProps) {
  const operationalDate = operationalDateInSaoPaulo();
  return (
    <div className={`${tableFrameClassName} admin-pricing-table-frame`}>
      <div className="admin-pricing-table-scroll overflow-auto">
        <table className={`${tableClassName} min-w-[64rem]`}>
          <caption className="sr-only">Preços públicos cadastrados</caption>
          <thead className="admin-pricing-table-header">
            <tr>
              <SortHeader page={page} field="vehicle">
                Veículo
              </SortHeader>
              <SortHeader page={page} field="amount">
                Preço público
              </SortHeader>
              <SortHeader page={page} field="startsOn">
                Vigência
              </SortHeader>
              <SortHeader page={page} field="status">
                Status
              </SortHeader>
              <SortHeader page={page} field="publishedAt">
                Publicação
              </SortHeader>
              <SortHeader page={page} field="updatedAt">
                Atualização
              </SortHeader>
              <th className="font-semibold" scope="col">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((price) => (
              <tr className="align-top transition hover:bg-surface-muted" key={price.id}>
                <td>
                  <p className="font-semibold text-text-primary">
                    {price.product.brand} {price.product.model}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {price.product.version} · {price.product.modelYear}
                  </p>
                </td>
                <td className="whitespace-nowrap font-semibold text-text-primary">
                  <p>{formatAdminPrice(price.money.amount, price.money.currencyCode)}</p>
                  <p className="mt-0.5 font-mono text-xs font-normal text-text-muted">
                    Preço #{price.id}
                  </p>
                </td>
                <td className="whitespace-nowrap text-text-secondary">
                  <p>{formatAdminDate(price.startsOn)}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    até {formatAdminDate(price.endsOn)}
                  </p>
                </td>
                <td>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(price.status, isAdminPriceExpired(price.status, price.endsOn, operationalDate))}`}
                  >
                    {adminPriceVisualStatusLabel(price.status, price.endsOn, operationalDate)}
                  </span>
                </td>
                <td className="whitespace-nowrap text-text-secondary">
                  {price.publishedAt ? formatAdminDate(price.publishedAt) : 'Não publicado'}
                </td>
                <td className="whitespace-nowrap text-text-secondary">
                  <p>{formatAdminDate(price.updatedAt)}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Criado em {formatAdminDate(price.createdAt)}
                  </p>
                </td>
                <td>
                  <div className="flex gap-2">
                    {isProductPublicPriceEditable(price.status) ? (
                      <button
                        className={buttonClassName({ compact: true, variant: 'secondary' })}
                        onClick={(event) => onEdit(price.id, event.currentTarget)}
                        type="button"
                      >
                        Editar
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">Somente leitura</span>
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
                          className={buttonClassName({ compact: true, variant: 'interactive' })}
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
                className={buttonClassName({ compact: true, variant: 'secondary' })}
                href={`/admin/prices?page=${page.page - 1}`}
              >
                Anterior
              </Link>
            ) : null}
            <span>
              Página {page.page} de {page.pageCount}
            </span>
            {page.page < page.pageCount ? (
              <Link
                className={buttonClassName({ compact: true, variant: 'secondary' })}
                href={`/admin/prices?page=${page.page + 1}`}
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
